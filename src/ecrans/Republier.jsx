// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import { problemesLot } from '../verifAnnonce.js';
// (12 nov., ext. 5.370 — discrétion, point 11) Republier par petits groupes étalés (src/discretion.js).
import { planParGroupes, GROUPE_MIN, GROUPE_MAX, PAUSE_GROUPE_MIN_S, PAUSE_GROUPE_MAX_S } from '../discretion.js';
import { motsVendeur } from '../profilVendeur.js';
const CLES_VERIF_NEUVES = ['numeroLu', 'numeroEcrit', 'ou', 'dejaEnLigne', 'dejaEnLigneOu'];
const pickVerif = (v) => { const o = {}; if (v && typeof v === 'object') for (const k of CLES_VERIF_NEUVES) if (v[k] !== undefined) o[k] = v[k]; return o; };
import { centimes } from '../beneficePaire.js';
import React, { useState, useEffect, useRef } from 'react';
import { ProgrammerRepub, noterPasPartie, ctxLigne } from '../RepubProgramme.jsx';
import { LigneHistoriqueRepub } from '../HistoriqueRepub.jsx';
import { pairesAuDepart, modifierProgrammes, marquerFinie } from '../repubProgramme.js';
import { tr, heure as heureLoc, date as dateLoc } from '../i18n/index.js';
import { createPortal } from 'react-dom';
import { montant } from '../format.js';
import { PhotoVide } from '../composants/PhotoVide.jsx';
import JaugeActions from '../JaugeActions.jsx';   // (10 nov., lot G) la jauge des 50 actions/h du compte
import { suivi } from '../suiviTravail.js';   // (11 nov., lot suivi-travail) VRM figé, détail et barre pendant la file
import { EncartPhotosAutresComptes } from '../PhotosEntreComptes.jsx';   // (11 nov., lot photos-comptes)
import { Numero } from '../composants/Numero.jsx';
import { CLE_REGLAGE_ETIQUETTE, PLACES as PLACES_ETIQUETTE, lireReglageEtiquette } from '../etiquetteNumero.js';
import { numeroACopier, texteKit, couvertureKit } from '../republierKit.js';
import { ACTIONS_REPUB, AUTH, Avancement, Bouton, C, ChipsModeles, ETAPES_REPUB, EXT_ATTENDUE, EXT_CAPACITES, FermeAuRetour, Icon, NAV, PhotoVinted, Pourquoi, SUPABASE_URL, Segmente, SheetShell, askConfirm, chargerPhotoBoite, demanderQuestionRepub, ecrireJournalRepub, extSait, ilYaBr, load, onCloudReady, poserRepubVivant, prixCourt, questionRepubOk, save, sbAuth, toast, verifierAvantPublication } from '../App.jsx';

// (9 nov., direction artistique 4) LE VOILE DES ATELIERS : un PORTAIL sur <body> (§7 :
// une feuille posée dans un conteneur qui crée un contexte d'empilement passe SOUS la
// barre du bas sur iPhone), la même forme que la feuille unique (styles-premium.css §12).
const VoileAtelier = ({ onClick, children }) => {
  const voile = <div className="vrm-atelier-voile" onClick={onClick} data-noswipe="1" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{children}</div>;
  return typeof document !== 'undefined' && document.body ? createPortal(voile, document.body) : voile;
};

// ⟦← App.jsx #1⟧
// (6 nov.) LES réglages de Republier — atelier ET « à la main » : une source, une règle par notion.
import { CLE_REGLAGES_REPUB, TITRE_VINTED_MAX, PHOTO_NEUTRE, CURSEURS_PHOTO, REDUCTIONS_RAPIDES, MODES_TITRE, bornerPhoto, photoNeutre, cssApercuPhoto, dessinerPhotoReglee, appliquerCouleursPixels, nomPhotoReglee, lotAppliquePrix, lotAppliqueTitre, lireReglagesRepub, reglagesGardes, reglagesAOuverture, resumeGardes, apercuRepub, annonceRepubliee, resumeReglages, tirerLettre, prixChange, titreChange } from "../republierReglages.js";

// ⟦← App.jsx #2⟧

// ── ÉDITEUR DE PHOTO (recadrer / zoomer / redresser / éclaircir) ──────────────
// Julien choisit une photo DEPUIS SON TÉLÉPHONE (sa photo d'origine, meilleure
// qualité que la vignette Vinted), la recadre, puis l'enregistre pour la
// téléverser LUI-MÊME sur Vinted. Rien n'est envoyé à Vinted par l'app, et on
// NE modifie JAMAIS automatiquement une photo pour esquiver la détection de
// doublon (refus tenu, cf. dossier). ⚠️ On ne charge pas l'image CDN de Vinted
// dans le canvas : cross-origin → canvas « tainted » → export interdit. On
// travaille donc sur un fichier local (aucun souci CORS).
// ── ATELIER DE REPUBLICATION — tranche 1 : préparer un brouillon VRM ─────────
// Modale NON destructive : on prépare le titre et le prix d'une annonce, on voit
// ses photos et son N° (qui ne change jamais, §5), on enregistre un brouillon
// DANS VRM. Rien n'est envoyé à Vinted ici — c'est le socle ; la publication et
// le retrait réels viennent dans une tranche ultérieure, sur confirmation.
function AtelierBrouillon({ it, e, k, draft, onSave, onClose }) {
  const prix0 = (it && it.price && typeof it.price === 'object') ? it.price.amount : (it && it.price);
  const [title, setTitle] = useState(draft && draft.title != null ? draft.title : (it.title || ''));
  const [price, setPrice] = useState(() => { const p = draft?.price!=null?draft.price:draft?.priceInput!=null?draft.priceInput:draft&&Object.prototype.hasOwnProperty.call(draft,'price')?'':prix0; return p == null ? '' : String(p); });
  const [desc,setDesc]=useState(draft?.desc??it.desc??it.description??'');
  const refDescBr=React.useRef(null);
  const [dimensions,setDimensions]=useState(draft?.dimensions||'');
  const [caracteristiques,setCaracteristiques]=useState(draft?.caracteristiques||[it.brand,it.size].filter(Boolean).join(' · '));
  const [done, setDone] = useState(false);
  const photos = ((draft && draft.photos && draft.photos.length) ? draft.photos
    : (Array.isArray(it.photosDetail) && it.photosDetail.length ? it.photosDetail
      : (Array.isArray(it.photos) && it.photos.length ? it.photos : [it.photo]))).filter(Boolean);
  // ── Réglages photo (tranche 2) — NON destructifs : on garde des VALEURS, pas
  //    des pixels (§15 : « les valeurs décrivent un rendu à partir de l'original,
  //    pas une succession de recompressions »). L'aperçu est en CSS (filtre +
  //    transform) : il marche sur les photos CDN de Vinted, qu'un canvas ne
  //    pourrait pas exporter (cross-origin → tainted). La photo finale sera
  //    produite À PARTIR DE L'ORIGINAL au moment de la publication (côté
  //    extension, qui a les octets) — jamais une recompression dans l'app (§11).
  //    Ordre de rendu prévu, stable (§15) : orientation → zoom → lumière/couleur.
  const DEF_R = { rot: 0, bright: 1, contrast: 1, sat: 1, zoom: 1 };
  const [rCommun, setRCommun] = useState(() => ({ ...DEF_R, ...((draft && draft.photoReglages && draft.photoReglages.commun) || {}) }));
  const [rParPhoto, setRParPhoto] = useState(() => ({ ...((draft && draft.photoReglages && draft.photoReglages.parPhoto) || {}) }));
  const [actif, setActif] = useState(0);            // photo en cours d'aperçu
  const [presets, setPresets] = useState(() => { const p = load('vrm_photo_presets', []); return Array.isArray(p) ? p : []; });
  const [presetNom, setPresetNom] = useState('');
  const aException = (i) => Object.prototype.hasOwnProperty.call(rParPhoto, i);
  const regDe = (i) => (aException(i) ? rParPhoto[i] : rCommun);
  const nExceptions = Object.keys(rParPhoto).length;
  const nCommunes = Math.max(0, photos.length - nExceptions);
  const cssDe = (r) => ({ filter: `brightness(${r.bright}) contrast(${r.contrast}) saturate(${r.sat})`, transform: `rotate(${r.rot}deg) scale(${r.zoom})`, transformOrigin: 'center center' });
  const rActif = regDe(actif);
  const majActif = (patch) => { if (aException(actif)) setRParPhoto(p => ({ ...p, [actif]: { ...p[actif], ...patch } })); else setRCommun(c => ({ ...c, ...patch })); };
  const basculeException = () => setRParPhoto(p => { const u = { ...p }; if (u[actif]) delete u[actif]; else u[actif] = { ...rCommun }; return u; });
  const appliquerToutes = () => setRParPhoto({});          // tout revient aux réglages communs (§13)
  const reinitPhotos = () => { setRCommun({ ...DEF_R }); setRParPhoto({}); };
  const enregistrerPreset = () => { const nom = presetNom.trim(); if (!nom) return; const next = [...presets.filter(x => x && x.nom !== nom), { nom, r: { ...rCommun } }].slice(-12); setPresets(next); save('vrm_photo_presets', next); setPresetNom(''); };
  const slider = (lab, cle, min, max, step) => (
    <label key={cle} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 86, flexShrink: 0, color: C.muted }}>{lab}</span>
      <input type="range" min={min} max={max} step={step} value={rActif[cle]} data-reglage={cle}
        onChange={ev => majActif({ [cle]: Number(ev.target.value) })} style={{ flex: 1, accentColor: C.accent }} />
    </label>
  );
  const prixCentimes = centimes(price);
  const prixNum = prixCentimes==null?null:prixCentimes/100;
  const prixOk = isFinite(prixNum) && prixNum > 0;
  const manques = [];
  if (!String(title).trim()) manques.push('le titre');
  if (!prixOk) manques.push('le prix');
  if (!photos.length) manques.push('au moins une photo');
  const photoReglages = { commun: rCommun, parPhoto: rParPhoto };
  const patch = { title: String(title).trim(), desc:desc.trim(), dimensions:dimensions.trim(), caracteristiques:caracteristiques.trim(), price: prixOk ? prixNum : null, priceInput:String(price), photos, photoReglages, id: it.id };
  const initial = useRef(JSON.stringify(patch));
  const ferme = useRef(false),fermeture=useRef(null),timerFermeture=useRef(null),proprietaire=useRef(AUTH.user?.id||'');
  React.useEffect(()=>{ferme.current=false;return()=>{ferme.current=true;clearTimeout(timerFermeture.current);};},[]);
  const [erreurSauvegarde,setErreurSauvegarde]=useState('');
  const conserver=()=>{if(proprietaire.current!==(AUTH.user?.id||'')){setErreurSauvegarde('Le compte VRM a changé. Rouvre l’éditeur dans le bon compte.');return false;}try{onSave(patch);initial.current=JSON.stringify(patch);setErreurSauvegarde('');return true;}catch{setErreurSauvegarde('Le brouillon n’a pas pu être conservé. Réessaie avant de fermer.');return false;}};
  const fermer = () => { if(ferme.current)return;if(proprietaire.current!==(AUTH.user?.id||'')){ferme.current=true;onClose();return;}if(JSON.stringify(patch)!==initial.current&&!conserver())return;ferme.current=true;onClose(); };fermeture.current=fermer;
  const enregistrer = () => { if(!conserver())return;setDone(true);timerFermeture.current=setTimeout(()=>fermeture.current?.(),700); };


  const champ = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, padding: '9px 11px', fontSize: 13, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const maj = { display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 4 };
  return (
    <VoileAtelier onClick={fermer}>
      <FermeAuRetour fermer={fermer}/>
      <div onClick={ev => ev.stopPropagation()} data-atelier-brouillon={k} style={{ background: C.bg, width: '100%', maxWidth: 560, maxHeight: '92vh', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>✨ Préparer l'annonce</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Gardé en brouillon : <b>rien n'est envoyé à Vinted</b>. Même N°.</div>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.muted }}>
            <span style={{ flexShrink: 0, fontWeight: 700, color: C.accentTexte, border: `1px solid ${C.accent}`, borderRadius: 12, padding: '2px 8px' }}>N°{(e && e.numero) || '—'}</span>
            <span>conservé — une republication ne lui donne jamais un nouveau numéro.</span>
          </div>
          {photos.length > 0 && (
            <div data-atelier-photos style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={maj}>Photos — réglages (aperçu ; la photo finale repart de l'original à la publication)</span>
              <div style={{ display: 'flex', justifyContent: 'center', background: C.card, borderRadius: 12, padding: 8 }}>
                <div style={{ width: 160, height: 210, overflow: 'hidden', borderRadius: 12, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PhotoVinted src={photos[actif]} alt="" data-photo-apercu loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', ...cssDe(rActif) }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {photos.slice(0, 12).map((p, i) => (
                  <button key={i} type="button" data-photo-vignette={i} onClick={() => setActif(i)}
                    style={{ position: 'relative', width: 46, height: 60, borderRadius: 12, overflow: 'hidden', background: C.border, flexShrink: 0, padding: 0, cursor: 'pointer', border: `2px solid ${i === actif ? C.accent : 'transparent'}` }}>
                    <PhotoVinted src={p} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', ...cssDe(regDe(i)) }} />
                    {aException(i) && <span title="réglages à part" style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: C.accent }} />}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {/* Rotation FINE : juste de quoi redresser une photo un peu de
                    travers (±15°, par pas de 0,5°) — plus de saut à 90°, trop
                    brutal (demande de Julien, 27 oct.). Un bouton remet droit. */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 86, flexShrink: 0, color: C.muted }}>Redresser</span>
                  <input type="range" min={-15} max={15} step={0.5} value={rActif.rot || 0} data-reglage="rot"
                    onChange={ev => majActif({ rot: Number(ev.target.value) })} style={{ flex: 1, accentColor: C.accent }} />
                  <button type="button" data-reglage-rot-zero onClick={() => majActif({ rot: 0 })} title="Remettre droit" style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, borderRadius: 12, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{(rActif.rot || 0) === 0 ? '0°' : `${rActif.rot > 0 ? '+' : ''}${rActif.rot}°`}</button>
                </label>
                {slider('Luminosité', 'bright', 0.5, 1.5, 0.01)}
                {slider('Contraste', 'contrast', 0.5, 1.5, 0.01)}
                {slider('Saturation', 'sat', 0, 2, 0.01)}
                {slider('Zoom', 'zoom', 1, 2, 0.01)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                <span data-photos-compte style={{ color: C.muted }}>{aException(actif) ? 'cette photo a ses propres réglages' : `réglages communs à ${nCommunes} photo${nCommunes > 1 ? 's' : ''}`}{nExceptions ? ` · ${nExceptions} exception${nExceptions > 1 ? 's' : ''}` : ''}</span>
                <button type="button" data-photo-exception onClick={basculeException} style={{ marginLeft: 'auto', border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 12, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{aException(actif) ? 'remettre au commun' : 'régler à part'}</button>
                <button type="button" data-appliquer-toutes onClick={appliquerToutes} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 12, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Appliquer à toutes</button>
                <button type="button" data-reset-photos onClick={reinitPhotos} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, borderRadius: 12, padding: '5px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Réinitialiser</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {presets.map((p, i) => (<button key={i} type="button" data-preset-apply={p.nom} onClick={() => majActif({ ...p.r })} style={{ border: `1px solid ${C.accent}`, background: `${C.accent}12`, color: C.accentTexte, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{p.nom}</button>))}
                <input value={presetNom} onChange={ev => setPresetNom(ev.target.value)} placeholder="Nom du préréglage" data-preset-nom style={{ ...champ, flex: '1 1 120px', maxWidth: 180, padding: '6px 9px', fontSize: 12 }} />
                <button type="button" data-preset-save onClick={enregistrerPreset} disabled={!presetNom.trim()} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: presetNom.trim() ? C.text : C.muted, borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: presetNom.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Enregistrer</button>
              </div>
            </div>
          )}
          <label style={{ display: 'block' }}><span style={maj}>Titre</span>
            <textarea value={title} onChange={ev => setTitle(ev.target.value)} rows={2} data-atelier-titre style={{ ...champ, resize: 'vertical' }} /></label>
          <label style={{ display: 'block' }}><span style={maj}>Prix (€)</span>
            <input value={price} onChange={ev => setPrice(ev.target.value)} inputMode="decimal" data-atelier-prix style={{ ...champ, maxWidth: 160 }} /></label>
          <label style={{display:'block'}}><span style={maj}>Description</span><ChipsModeles valeur={desc} surChange={setDesc} champ={refDescBr} vars={{ titre:title, prix:Number(String(price).replace(',','.')), numero:e&&e.numero, taille:it.size, marque:it.brand }}/><textarea ref={refDescBr} aria-label="Description du brouillon" value={desc} onChange={ev=>setDesc(ev.target.value)} rows={4} style={champ}/></label>
          <label style={{display:'block'}}><span style={maj}>Caractéristiques (marque, modèle, état…)</span><input aria-label="Caractéristiques du brouillon" value={caracteristiques} onChange={ev=>setCaracteristiques(ev.target.value)} style={champ}/></label>
          <label style={{display:'block'}}><span style={maj}>Dimensions — si utile, avec l’unité</span><input aria-label="Dimensions du brouillon" value={dimensions} onChange={ev=>setDimensions(ev.target.value)} placeholder="Ex. 30 × 20 × 10 cm" style={champ}/></label>
          <p style={{fontSize:12,color:C.muted}}>Photos et champs du catalogue : <a href={'https://www.vinted.fr/items/'+it.id+'/edit'} target="_blank" rel="noreferrer">compléter l’annonce sur Vinted ↗</a>.</p>
          {erreurSauvegarde&&<p role="alert">{erreurSauvegarde}</p>}
          {manques.length > 0 && <div data-atelier-manque style={{ fontSize: 12, color: C.warn, lineHeight: 1.45 }}>À compléter avant de publier : {manques.join(', ')}.</div>}
          {draft && <div style={{ fontSize: 12, color: C.muted }}>Dernier brouillon{draft.updatedAt ? ` le ${new Date(draft.updatedAt).toLocaleDateString('fr-FR')}` : ''}{draft.versions && draft.versions.length ? ` · ${draft.versions.length} version${draft.versions.length > 1 ? 's' : ''} gardée${draft.versions.length > 1 ? 's' : ''}` : ''}.</div>}
          <button type="button" data-atelier-enregistrer onClick={enregistrer} disabled={done}
            style={{ border: `1px solid ${C.accent}`, background: done ? C.accent : `${C.accent}12`, color: done ? '#fff' : C.accent, borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {done ? '✓ Brouillon enregistré' : '💾 Enregistrer le brouillon'}</button>
        </div>
      </div>
    </VoileAtelier>
  );
}
// ══ ATELIER DE REPUBLICATION — TRANCHE 3 : lots titres + prix (non destructif) ══
// Modifier le TITRE et le PRIX d'une SÉLECTION d'annonces d'un coup, avec un
// aperçu avant→après par article, et écrire le résultat dans les BROUILLONS
// (`vinted_annonce_drafts`) — rien n'est envoyé à Vinted (la publication réelle
// est la tranche 5). Deux règles du dossier tiennent la logique :
//   · le titre n'est jamais COUPÉ en silence (§ « limite signalée, jamais coupée ») :
//     on signale quand il dépasse la limite Vinted, on ne tronque pas ;
//   · le prix n'est jamais CUMULATIF : chaque aperçu se calcule depuis le prix de
//     BASE (le brouillon s'il existe, sinon l'annonce), dans un ORDRE explicite —
//     (1) ajustement ou prix commun → (2) arrondi → (3) terminaison → (4) plancher.
//   · le plancher (§19) : jamais sous le prix d'achat. Sous lui ⇒ ramené au
//     plancher ET signalé — mieux vaut un prix qui tient qu'un prix qui perd.
// (6 nov.) `TITRE_VINTED_MAX`, `lotAppliqueTitre` et `lotAppliquePrix` vivent dans
// src/republierReglages.js : UNE règle pour cet atelier, Republier et « à la main ».
function AtelierLots({ candidats, onSave, onClose }) {
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState('');
  const [tMode, setTMode] = useState('aucun');   // aucun|prefixe|suffixe|remplacer|supprimer|inserer
  const [tVal, setTVal] = useState('');
  const [tChe, setTChe] = useState('');
  const [tPos, setTPos] = useState('0');
  const [pBase, setPBase] = useState('aucun');   // aucun|fixe|pct|commun
  const [pDelta, setPDelta] = useState('');
  const [pCommun, setPCommun] = useState('');
  const [pArr, setPArr] = useState('aucun');     // aucun|euro|5|10
  const [pSens, setPSens] = useState('proche');  // proche|sup|inf
  const [pFin, setPFin] = useState('aucune');    // aucune|00|50|90|99
  const [done, setDone] = useState(false);
  const liste = candidats.filter(c => !q.trim() || (c.titre || '').toLowerCase().includes(q.trim().toLowerCase()) || String(c.key).includes(q.trim()));
  const toggle = (k) => setSel(s => { const u = new Set(s); u.has(k) ? u.delete(k) : u.add(k); return u; });
  const tout = () => setSel(new Set(liste.map(c => c.key)));
  const rien = () => setSel(new Set());
  const opT = { mode: tMode, valeur: tVal, chercher: tChe, pos: tPos };
  const opP = { base: pBase, delta: pDelta, commun: pCommun, arrondi: pArr, sens: pSens, fin: pFin };
  const changeT = tMode !== 'aucun';
  const changeP = pBase !== 'aucun' || pArr !== 'aucun' || pFin !== 'aucune';
  const apercu = (c) => {
    const nt = changeT ? lotAppliqueTitre(c.titre, opT) : null;
    const np = changeP ? lotAppliquePrix(c.prix, opP, c.floor) : null;
    return { nt, np, tropLong: nt != null && nt.length > TITRE_VINTED_MAX };
  };
  const selArr = candidats.filter(c => sel.has(c.key));
  const nAppliquables = selArr.filter(c => { const a = apercu(c); return (a.nt != null && a.nt !== c.titre) || (a.np != null && a.np.prix !== c.prix); }).length;
  const enregistrer = () => {
    if (!sel.size || (!changeT && !changeP) || done) return;
    for (const c of selArr) {
      const a = apercu(c);
      const patch = { id: c.id };
      if (a.nt != null && a.nt !== c.titre) patch.title = a.nt;
      if (a.np != null && a.np.prix !== c.prix && a.np.prix > 0) patch.price = a.np.prix;
      if (patch.title != null || patch.price != null) onSave(c.key, patch);
    }
    setDone(true); setTimeout(onClose, 800);
  };
  const champ = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '7px 10px', fontSize: 13, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const maj = { display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 5 };
  const selStyle = { ...champ, padding: '6px 8px' };
  return (
    <VoileAtelier onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={ev => ev.stopPropagation()} data-lots-modal style={{ background: C.bg, width: '100%', maxWidth: 620, maxHeight: '94vh', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>✨ Lots — titres &amp; prix</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Gardé en brouillon : <b>rien n'est envoyé à Vinted</b>. Mêmes N°.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── sélection ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ ...maj, margin: 0, flex: 1 }}>Articles ({sel.size} choisi{sel.size > 1 ? 's' : ''})</span>
              <button type="button" data-lot-tout onClick={tout} style={{ ...champ, cursor: 'pointer', padding: '5px 9px', fontSize: 12 }}>Tout</button>
              <button type="button" data-lot-rien onClick={rien} style={{ ...champ, cursor: 'pointer', padding: '5px 9px', fontSize: 12 }}>Rien</button>
            </div>
            <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Filtrer par titre ou numéro" style={{ ...champ, width: '100%' }} />
            <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {liste.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.muted }}>Aucune annonce.</div>}
              {liste.map(c => { const a = apercu(c); const chg = (a.nt != null && a.nt !== c.titre) || (a.np != null && a.np.prix !== c.prix); return (
                <label key={c.key} data-lot-ligne={c.key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 10px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <input type="checkbox" data-lot-item={c.key} checked={sel.has(c.key)} onChange={() => toggle(c.key)} style={{ marginTop: 2, accentColor: C.accent, flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.accentTexte, flexShrink: 0 }}>N°{c.key}</span>
                      <span style={{ fontSize: 12, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titre || '—'}</span>
                    </span>
                    {sel.has(c.key) && chg && (
                      <span style={{ display: 'block', fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>
                        {a.nt != null && a.nt !== c.titre && <span data-apercu-titre={c.key} style={{ display: 'block', color: a.tropLong ? C.warn : C.muted }}>→ {a.nt}{a.tropLong && <b data-lot-trop-long={c.key} style={{ color: C.warn }}> · {a.nt.length}/{TITRE_VINTED_MAX}, trop long pour Vinted</b>}</span>}
                        {a.np != null && a.np.prix !== c.prix && <span data-apercu-prix={c.key} style={{ display: 'block' }}>{prixCourt(c.prix)} → <b style={{ color: C.text }}>{prixCourt(a.np.prix)}</b>{a.np.sousPlancher && <span data-lot-plancher={c.key} style={{ color: C.warn }}> · ramené au plancher (prix d'achat)</span>}</span>}
                      </span>
                    )}
                  </span>
                </label>
              ); })}
            </div>
          </div>
          {/* ── titres ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={maj}>Titre</span>
            <select data-lot-titre-mode value={tMode} onChange={ev => setTMode(ev.target.value)} style={selStyle}>
              <option value="aucun">Ne pas toucher au titre</option>
              <option value="prefixe">Ajouter au début</option>
              <option value="suffixe">Ajouter à la fin</option>
              <option value="remplacer">Remplacer un texte</option>
              <option value="supprimer">Supprimer un texte</option>
              <option value="inserer">Insérer à une position</option>
            </select>
            {(tMode === 'remplacer' || tMode === 'supprimer') && <input data-lot-titre-chercher value={tChe} onChange={ev => setTChe(ev.target.value)} placeholder="Texte à trouver" style={champ} />}
            {tMode === 'inserer' && <input data-lot-titre-pos value={tPos} onChange={ev => setTPos(ev.target.value)} inputMode="numeric" placeholder="Position (0 = début)" style={{ ...champ, maxWidth: 200 }} />}
            {tMode !== 'aucun' && tMode !== 'supprimer' && <input data-lot-titre-valeur value={tVal} onChange={ev => setTVal(ev.target.value)} placeholder={tMode === 'remplacer' ? 'Par (vide = supprimer)' : 'Texte à ajouter'} style={champ} />}
          </div>
          {/* ── prix ──────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={maj}>Prix <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— ordre : ajustement → arrondi → terminaison → plancher</span></span>
            <select data-lot-prix-base value={pBase} onChange={ev => setPBase(ev.target.value)} style={selStyle}>
              <option value="aucun">Ne pas toucher au prix</option>
              <option value="fixe">Ajouter / retirer un montant (€)</option>
              <option value="pct">Ajouter / retirer un pourcentage (%)</option>
              <option value="commun">Mettre tout le monde au même prix</option>
            </select>
            {(pBase === 'fixe' || pBase === 'pct') && <input data-lot-prix-delta value={pDelta} onChange={ev => setPDelta(ev.target.value)} inputMode="decimal" placeholder={pBase === 'pct' ? 'ex. -10 (= −10\u00a0%)' : 'ex. -5 (= −5\u00a0€)'} style={{ ...champ, maxWidth: 220 }} />}
            {pBase === 'commun' && <input data-lot-prix-commun value={pCommun} onChange={ev => setPCommun(ev.target.value)} inputMode="decimal" placeholder="Prix commun (€)" style={{ ...champ, maxWidth: 200 }} />}
            {pBase !== 'aucun' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select data-lot-arrondi value={pArr} onChange={ev => setPArr(ev.target.value)} style={{ ...selStyle, flex: '1 1 120px' }}>
                <option value="aucun">Sans arrondi</option>
                <option value="euro">À l'euro</option>
                <option value="5">Au multiple de 5</option>
                <option value="10">Au multiple de 10</option>
              </select>
              {pArr !== 'aucun' && <select data-lot-sens value={pSens} onChange={ev => setPSens(ev.target.value)} style={{ ...selStyle, flex: '1 1 110px' }}>
                <option value="proche">au plus proche</option>
                <option value="sup">au-dessus</option>
                <option value="inf">en-dessous</option>
              </select>}
              <select data-lot-fin value={pFin} onChange={ev => setPFin(ev.target.value)} style={{ ...selStyle, flex: '1 1 130px' }}>
                <option value="aucune">Sans terminaison</option>
                <option value="00">finir en ,00</option>
                <option value="50">finir en ,50</option>
                <option value="90">finir en ,90</option>
                <option value="99">finir en ,99</option>
              </select>
            </div>}
            <div className="vrm-aide" style={{ fontSize: 11, color: C.muted }}>Jamais sous le prix d'achat ; chaque baisse part du prix actuel.</div>
          </div>
          <button type="button" data-lots-enregistrer onClick={enregistrer} disabled={!sel.size || (!changeT && !changeP) || done}
            style={{ border: `1px solid ${C.accent}`, background: done ? C.accent : `${C.accent}12`, color: done ? '#fff' : C.accent, borderRadius: 12, padding: '12px', fontSize: 15, fontWeight: 700, cursor: (sel.size && (changeT || changeP) && !done) ? 'pointer' : 'default', fontFamily: 'inherit', opacity: (!sel.size || (!changeT && !changeP)) ? 0.5 : 1 }}>
            {done ? '✓ Brouillons enregistrés' : `💾 Enregistrer dans les brouillons (${nAppliquables})`}</button>
        </div>
      </div>
    </VoileAtelier>
  );
}
// ══ ATELIER DE REPUBLICATION — TRANCHE 4 : file de publication (non destructif) ══
// Ordonner une SÉLECTION de brouillons et les faire passer un par un, avec un
// espacement, pause/reprise/arrêt, et une reprise après rechargement. ⚠️ Cette
// tranche NE PUBLIE PAS : l'exécuteur est un ESSAI À BLANC qui revérifie
// l'éligibilité et marque « prête » — la publication réelle (retrait +
// recréation sur Vinted) est la tranche 5, et chaque geste destructif y restera
// sur ta confirmation (§3 : on ne republie jamais en file à l'aveugle). Ce qui
// est réel ici et sera réutilisé tel quel par la 5 :
//   · l'ORDRE (monter/descendre, mélanger, trier par N°/prix) ;
//   · l'ESPACEMENT fixe ou variable, BORNÉ (jamais une rafale) ;
//   · PAUSE/REPRISE/ARRÊT — une pause pendant l'attente n'engage rien ;
//   · la REPRISE après interruption : l'état est gardé (`vrm_atelier_file`) et
//     restauré EN PAUSE (jamais relancé tout seul — ce serait un robot) ;
//   · l'ÉLIGIBILITÉ revérifiée JUSTE AVANT chaque article (un article devenu
//     vendu/incomplet est SAUTÉ, avec sa raison, jamais publié par erreur) ;
//   · le VERROU par article : un seul « en cours » à la fois, jamais deux fois.
const FILE_ESP_MIN = 0;        // secondes — borne basse (0 = aussi vite que possible, pour l'essai à blanc)
const FILE_ESP_MAX = 3600;     // secondes — borne haute (1 h) : au-delà ce n'est plus une file
const fileClamp = (s) => Math.max(FILE_ESP_MIN, Math.min(FILE_ESP_MAX, Math.round(Number(s) || 0)));
function AtelierFile({ candidats, verifier, publier, majExt, onClose }) {
  const CAND = React.useMemo(() => { const m = {}; for (const c of candidats) m[c.key] = c; return m; }, [candidats]);
  // ── Mode RÉEL (tranche 5) : publier pour de vrai sur Vinted (baisser le prix
  //    en place). Éteint par défaut, et ARMÉ par une case de confirmation — le
  //    §3 interdit de republier en file à l'aveugle. L'extension revérifie tout
  //    (confirmation, compte, coffre, modèle) ; rien ne part sans elle.
  const [reel, setReel] = useState(false);
  const [reelOk, setReelOk] = useState(false);
  const [pct, setPct] = useState('10');
  const pctNum = Math.max(0, Math.min(90, Number(String(pct).replace(',', '.')) || 0));
  const busy = React.useRef(false);
  const [q, setQ] = useState(() => {
    const raw = load('vrm_atelier_file', null);
    if (raw && typeof raw === 'object' && Array.isArray(raw.ordre)) {
      return { ordre: raw.ordre.map(String), statuts: raw.statuts || {}, raisons: raw.raisons || {},
        mode: raw.mode === 'run' ? 'pause' : (raw.mode || 'idle'),   // jamais relancé tout seul
        esp: { type: (raw.esp && raw.esp.type) || 'fixe', min: fileClamp(raw.esp && raw.esp.min), max: fileClamp(raw.esp && raw.esp.max) } };
    }
    return { ordre: [], statuts: {}, raisons: {}, titres: {}, mode: 'idle', esp: { type: 'fixe', min: 30, max: 120 } };
  });
  const titreDe = (k) => (CAND[k] && CAND[k].titre) || (q.titres && q.titres[k]) || '—';
  const [sel, setSel] = useState(() => new Set());
  // ⚠️ Persistance SYNCHRONE (pas `save`, qui est anti-rebondé 500 ms) : une file
  //    interrompue dans la demi-seconde qui suit sa dernière action perdrait son
  //    état, et « reprise après interruption » ne tiendrait pas. L'état de la
  //    file est LOCAL à l'appareil (un process en cours), pas synchronisé.
  React.useEffect(() => { try { localStorage.setItem('vrm_atelier_file', JSON.stringify(q)); } catch (_) {} }, [q]);
  // Le moteur : en marche, programme le PROCHAIN article « attente » après le
  // délai d'espacement, puis le traite (essai à blanc). Une pause ou un arrêt
  // annule le minuteur AVANT tout traitement — l'étape critique n'est jamais
  // coupée en deux parce qu'elle ne commence qu'à la fin du délai.
  React.useEffect(() => {
    if (q.mode !== 'run') return;
    if (busy.current) return;                           // verrou : un seul article à la fois (§ anti-doublon)
    const k = q.ordre.find(x => (q.statuts[x] || 'attente') === 'attente');
    if (k == null) { setQ(p => (p.mode === 'run' ? { ...p, mode: 'idle' } : p)); return; }
    const delay = q.esp.type === 'variable'
      ? (fileClamp(q.esp.min) + Math.random() * Math.max(0, fileClamp(q.esp.max) - fileClamp(q.esp.min))) * 1000
      : fileClamp(q.esp.min) * 1000;
    let annule = false;
    const t = setTimeout(async () => {
      if (annule) return;                               // pausé/arrêté PENDANT l'attente : rien n'a commencé
      // 1. éligibilité revérifiée JUSTE AVANT (un article devenu vendu/incomplet est sauté)
      const v = (() => { try { return verifier(k); } catch (_) { return { ok: false, raison: 'vérification impossible' }; } })();
      if (!v.ok) { setQ(p => ({ ...p, statuts: { ...p.statuts, [k]: 'saute' }, raisons: { ...p.raisons, [k]: v.raison || 'inéligible' } })); return; }
      // 2. essai à blanc : on marque « prête », rien ne part.
      if (!(reel && typeof publier === 'function')) { setQ(p => (p.mode === 'run' ? { ...p, statuts: { ...p.statuts, [k]: 'fait' } } : p)); return; }
      // 3. mode RÉEL : l'étape critique (le PUT sur Vinted) commence — on prend
      //    le verrou, on la laisse FINIR même si on met en pause pendant (jamais
      //    coupée en deux), et on enregistre son résultat quoi qu'il arrive.
      busy.current = true;
      setQ(p => ({ ...p, statuts: { ...p.statuts, [k]: 'encours' } }));
      let res; try { res = await publier(CAND[k] ? CAND[k].id : k, pctNum); } catch (_) { res = { ok: false, raison: 'erreur' }; }
      busy.current = false;
      setQ(p => ({ ...p, statuts: { ...p.statuts, [k]: (res && res.ok) ? 'fait' : 'echec' }, raisons: (res && res.ok) ? p.raisons : { ...p.raisons, [k]: (res && res.raison) || 'échec' } }));
    }, delay);
    return () => { annule = true; clearTimeout(t); };
  }, [q.mode, q.statuts, q.ordre, q.esp, verifier, publier, reel, pctNum]);
  // La file traite PAR CLÉ : un article reste dans la file même si l'annonce
  // n'est plus proposée (devenue inéligible) — il y sera SAUTÉ, pas effacé en
  // silence (un article qui disparaît sans un mot se lit comme une perte).
  const enFile = q.ordre;
  const reste = enFile.filter(k => (q.statuts[k] || 'attente') === 'attente').length;
  const faits = enFile.filter(k => q.statuts[k] === 'fait').length;
  const sautes = enFile.filter(k => q.statuts[k] === 'saute').length;
  const dispo = candidats.filter(c => !q.ordre.includes(c.key));
  const ajouter = () => { const add = [...sel].filter(k => !q.ordre.includes(k)); if (!add.length) return; setQ(p => ({ ...p, ordre: [...p.ordre, ...add], statuts: { ...p.statuts, ...Object.fromEntries(add.map(k => [k, 'attente'])) }, titres: { ...p.titres, ...Object.fromEntries(add.map(k => [k, (CAND[k] && CAND[k].titre) || k])) } })); setSel(new Set()); };
  const retirer = (k) => setQ(p => ({ ...p, ordre: p.ordre.filter(x => x !== k) }));
  const bouge = (k, d) => setQ(p => { const o = [...p.ordre]; const i = o.indexOf(k); const j = i + d; if (i < 0 || j < 0 || j >= o.length) return p; [o[i], o[j]] = [o[j], o[i]]; return { ...p, ordre: o }; });
  const melanger = () => setQ(p => { const o = [...p.ordre]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return { ...p, ordre: o }; });
  const trier = (cle) => setQ(p => { const o = [...p.ordre].sort((a, b) => { const A = CAND[a] || {}, B = CAND[b] || {}; if (cle === 'num') return (Number(a) || 1e9) - (Number(b) || 1e9); if (cle === 'prix') return (A.prix ?? 1e9) - (B.prix ?? 1e9); return 0; }); return { ...p, ordre: o }; });
  const demarrer = () => { if (!reste || (reel && !reelOk)) return; setQ(p => ({ ...p, mode: 'run' })); };
  const pause = () => setQ(p => ({ ...p, mode: 'pause' }));
  const reprendre = () => setQ(p => ({ ...p, mode: reste ? 'run' : 'idle' }));
  const arreter = () => setQ(p => ({ ...p, mode: 'idle' }));
  const vider = () => setQ(p => ({ ordre: [], statuts: {}, raisons: {}, titres: {}, mode: 'idle', esp: p.esp }));
  const champ = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 9px', fontSize: 13, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const maj = { display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 5 };
  const btn = (extra) => ({ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', ...extra });
  const stLabel = { attente: 'en attente', fait: reel ? 'publiée ✓' : 'prête ✓', saute: 'sautée', echec: 'échec', encours: 'en cours…' };
  return (
    <VoileAtelier onClick={onClose}>
      <FermeAuRetour fermer={onClose}/>
      <div onClick={ev => ev.stopPropagation()} data-file-modal data-file-mode={q.mode} style={{ background: C.bg, width: '100%', maxWidth: 620, maxHeight: '94vh', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>✨ File de publication</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Ordonne et cadence tes brouillons. {reel ? <><b style={{ color: C.warn }}>Publication réelle</b> — chaque annonce sera modifiée sur Vinted (prix baissé), une par une, à l'espacement choisi.</> : <><b>Essai à blanc</b> — rien n'est publié tant que tu n'actives pas la publication réelle, plus bas.</>}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── à ajouter ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={maj}>Brouillons prêts ({dispo.length})</span>
            <div style={{ maxHeight: 130, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {dispo.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.muted }}>Aucun brouillon à ajouter. Prépare d'abord des annonces (✨ Préparer, ou Lots).</div>}
              {dispo.map(c => (
                <label key={c.key} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '6px 10px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <input type="checkbox" data-file-cand={c.key} checked={sel.has(c.key)} onChange={() => setSel(s => { const u = new Set(s); u.has(c.key) ? u.delete(c.key) : u.add(c.key); return u; })} style={{ accentColor: C.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.accentTexte, flexShrink: 0 }}>N°{c.key}</span>
                  <span style={{ fontSize: 12, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titre || '—'}</span>
                </label>
              ))}
            </div>
            <button type="button" data-file-ajouter onClick={ajouter} disabled={!sel.size} style={btn({ alignSelf: 'flex-start', opacity: sel.size ? 1 : 0.5, cursor: sel.size ? 'pointer' : 'default' })}>Ajouter à la file ({sel.size})</button>
          </div>
          {/* ── la file ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...maj, margin: 0, flex: 1 }}>File — {enFile.length} article{enFile.length > 1 ? 's' : ''} · {reste} à faire · {faits} prête{faits > 1 ? 's' : ''}{sautes ? ` · ${sautes} sautée${sautes > 1 ? 's' : ''}` : ''}</span>
              <button type="button" data-file-melanger onClick={melanger} style={btn({ padding: '5px 8px', fontSize: 12 })}>Mélanger</button>
              <select data-file-trier onChange={ev => { if (ev.target.value) trier(ev.target.value); ev.target.value = ''; }} defaultValue="" style={{ ...champ, padding: '5px 7px', fontSize: 12 }}>
                <option value="">Trier…</option>
                <option value="num">par numéro</option>
                <option value="prix">par prix</option>
              </select>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {enFile.length === 0 && <div style={{ padding: 10, fontSize: 12, color: C.muted }}>File vide.</div>}
              {enFile.map((k, idx) => { const st = q.statuts[k] || 'attente'; return (
                <div key={k} data-file-item={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: C.muted, width: 18, flexShrink: 0 }}>{idx + 1}.</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.accentTexte, flexShrink: 0 }}>N°{k}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titreDe(k)}</span>
                  <span data-file-statut={k} style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: st === 'fait' ? C.accent : st === 'saute' || st === 'echec' ? C.warn : C.muted }}>{stLabel[st]}{(st === 'saute' || st === 'echec') && q.raisons[k] ? ` · ${q.raisons[k]}` : ''}</span>
                  {q.mode === 'idle' && st === 'attente' && <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button type="button" data-file-monter={k} onClick={() => bouge(k, -1)} aria-label="Monter" style={btn({ padding: '3px 7px' })}>↑</button>
                    <button type="button" data-file-descendre={k} onClick={() => bouge(k, 1)} aria-label="Descendre" style={btn({ padding: '3px 7px' })}>↓</button>
                    <button type="button" data-file-retirer={k} onClick={() => retirer(k)} aria-label="Retirer" style={btn({ padding: '3px 7px', color: C.muted })}>×</button>
                  </span>}
                </div>
              ); })}
            </div>
          </div>
          {/* ── espacement ────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={maj}>Espacement entre deux publications</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select data-file-esp-type value={q.esp.type} onChange={ev => setQ(p => ({ ...p, esp: { ...p.esp, type: ev.target.value } }))} style={{ ...champ, flex: '1 1 120px' }}>
                <option value="fixe">Fixe</option>
                <option value="variable">Variable (entre deux bornes)</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>{q.esp.type === 'variable' ? 'de' : ''}<input data-file-esp-min value={q.esp.min} onChange={ev => setQ(p => ({ ...p, esp: { ...p.esp, min: fileClamp(ev.target.value) } }))} inputMode="numeric" style={{ ...champ, width: 70 }} />s</label>
              {q.esp.type === 'variable' && <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>à<input data-file-esp-max value={q.esp.max} onChange={ev => setQ(p => ({ ...p, esp: { ...p.esp, max: fileClamp(ev.target.value) } }))} inputMode="numeric" style={{ ...champ, width: 70 }} />s</label>}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{FILE_ESP_MAX / 60} min au plus. {motsVendeur().Un} vendu{motsVendeur().e} ou incomplet{motsVendeur().e} entre-temps est sauté{motsVendeur().e}.</div>
          </div>
          {/* ── mode RÉEL : publier pour de vrai (baisser le prix sur Vinted) ── */}
          {typeof publier === 'function' && q.mode === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, border: `1px solid ${reel ? C.warn : C.border}`, borderRadius: 12, padding: 10, background: reel ? `${C.warn}0c` : 'transparent' }}>
              <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" data-file-reel checked={reel} onChange={ev => { setReel(ev.target.checked); if (!ev.target.checked) setReelOk(false); }} style={{ marginTop: 2, accentColor: C.warn, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text }}><b>Pour de vrai sur Vinted</b> : baisse chaque prix. <span style={{ color: C.muted }}>Même N°, rien supprimé, douteuse sautée.</span></span>
              </label>
              {majExt && <div data-file-reel-maj style={{ fontSize: 12, color: C.warn, paddingLeft: 27 }}>Mets l'extension à jour ({EXT_ATTENDUE}), connectée au bon compte : sinon rien ne part.</div>}
              {reel && <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text }}>Baisser le prix de <input data-file-pct value={pct} onChange={ev => setPct(ev.target.value)} inputMode="numeric" style={{ ...champ, width: 64 }} /> % <span style={{ color: C.muted }}>(jamais sous le prix d'achat)</span></label>
                <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13, color: C.text }}>
                  <input type="checkbox" data-file-reel-confirme checked={reelOk} onChange={ev => setReelOk(ev.target.checked)} style={{ marginTop: 2, accentColor: C.warn, flexShrink: 0 }} />
                  <span>Je confirme : chaque prix de la file <b>baissé de {pctNum}&nbsp;%</b> sur Vinted.</span>
                </label>
              </>}
            </div>
          )}
          {/* ── commandes ─────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {q.mode === 'idle' && <button type="button" data-file-demarrer onClick={demarrer} disabled={!reste || (reel && !reelOk)} style={btn({ border: `1px solid ${reel ? C.warn : C.accent}`, background: reel ? `${C.warn}12` : `${C.accent}12`, color: reel ? C.warn : C.accent, padding: '10px 16px', fontSize: 13, fontWeight: 700, opacity: (reste && (!reel || reelOk)) ? 1 : 0.5, cursor: (reste && (!reel || reelOk)) ? 'pointer' : 'default' })}>{reel ? `▶ Publier pour de vrai (${reste})` : "▶ Démarrer l'essai"}</button>}
            {q.mode === 'run' && <button type="button" data-file-pause onClick={pause} style={btn({ border: `1px solid ${C.accent}`, color: C.accentTexte, padding: '10px 16px', fontSize: 13, fontWeight: 700 })}>⏸ Pause</button>}
            {q.mode === 'pause' && <button type="button" data-file-reprendre onClick={reprendre} style={btn({ border: `1px solid ${C.accent}`, background: `${C.accent}12`, color: C.accentTexte, padding: '10px 16px', fontSize: 13, fontWeight: 700 })}>▶ Reprendre</button>}
            {q.mode !== 'idle' && <button type="button" data-file-arreter onClick={arreter} style={btn({ padding: '10px 16px', fontSize: 13, color: C.warn })}>■ Arrêter</button>}
            {q.mode === 'idle' && enFile.length > 0 && <button type="button" data-file-vider onClick={vider} style={btn({ marginLeft: 'auto', color: C.muted })}>Vider la file</button>}
          </div>
          {q.mode === 'pause' && <div style={{ fontSize: 12, color: C.muted }}>En pause : reprends à la main. Jamais relancée toute seule.</div>}
        </div>
      </div>
    </VoileAtelier>
  );
}
// ⟦← App.jsx #3⟧
// Ce que dit chaque ligne, et ce que fait le bouton (une phrase par état).
const TEXTE_REFAIRE = {
  'a-refaire': (b) => `Brouillon pas créé.${b.supprime ? ' L’annonce est retirée de la vente.' : ''}${b.peutExister ? ' Regarde d’abord tes brouillons Vinted : il y est peut-être déjà.' : ''}`,
  'a-publier': () => 'Brouillon rangé sur Vinted, mise en ligne pas passée.',
  'a-verifier': () => 'Peut-être déjà en ligne : regarde ton dressing, sinon « Voir mes brouillons ».',
  interrompu: (b) => `Interrompu en route (navigateur fermé ou extension arrêtée).${b.supprime ? ' L’annonce est retirée de la vente.' : ' Regarde si elle est encore en ligne.'}`,
};
const BOUTON_REFAIRE = { 'a-refaire': 'Refaire le brouillon', 'a-publier': 'Mettre le brouillon en ligne', interrompu: 'Refaire le brouillon' };
function BrouillonsARefaire({ br, refaire, onClose, onVoirBrouillons, peutAgir, raisonAgir }) {
  const { liste, ecarter, revoir } = br;
  const regles = (Array.isArray(liste) && Array.isArray(liste.regles)) ? liste.regles : [];
  const [etat, setEtat] = useState({});            // { [cle]: { etape, raison } }
  const lancer = async (b) => {
    const enLigne = b.publier && b.supprime;
    const desc = b.quoi === 'a-publier'
      ? `« ${b.titre} » : le brouillon déjà rangé sur Vinted ${enLigne ? 'est mis en ligne' : 'est gardé (il n’est pas mis en ligne)'} — aucun second brouillon n’est créé.`
      : `« ${b.titre} »${b.prix ? ` à ${prixCourt(b.prix)}` : ''} : un brouillon est recréé sur Vinted à partir de ce qui est enregistré dans VRM (photos, titre, prix, description).${enLigne ? ' Puis il est mis en ligne : Vinted a confirmé que l’ancienne annonce était retirée.' : ' Il n’est PAS mis en ligne' + (b.publier ? ' : Vinted n’a pas confirmé que l’ancienne était retirée.' : '.')}${b.peutExister ? ' ⚠️ Vinted n’avait pas répondu clairement la première fois : s’il est déjà dans tes brouillons, tu en auras deux.' : ''}`;
    const ok = await askConfirm({ title: BOUTON_REFAIRE[b.quoi] + ' ?', desc, ok: BOUTON_REFAIRE[b.quoi] });
    if (!ok) return;
    setEtat((e) => ({ ...e, [b.cle]: { etape: 'envoi' } }));
    let r = null; try { r = await refaire(b); } catch (_) { r = null; }
    setEtat((e) => ({ ...e, [b.cle]: r ? { etape: r.etape || 'echec', raison: r.raison || '' } : { etape: 'echec', raison: "l'extension n'a pas répondu" } }));
  };
  return (
    <SheetShell onClose={onClose} maxWidth={520}>
      <div data-refaire-liste={Array.isArray(liste) ? liste.length : liste === null ? 'passu' : 'lecture'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text, flex: 1 }}>Brouillons à refaire <Pourquoi label="C'est quoi ?">Les republications par brouillon qui ne sont pas allées au bout. Chaque geste demande ta confirmation ; rien ne part tout seul.</Pourquoi></h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer' }}>✕</button>
        </div>
        {liste === undefined && <div style={{ fontSize: 13, color: C.muted }}>Lecture…</div>}
        {liste === null && <div data-refaire-passu style={{ fontSize: 13, color: C.muted }}>VRM n'a pas pu lire ce qui reste à refaire — rien n'est perdu, réessaie dans un moment.</div>}
        {Array.isArray(liste) && !liste.length && <div style={{ fontSize: 13, color: C.muted }}>{regles.length ? 'Rien d’autre à refaire.' : 'Rien à refaire : tout est allé au bout.'}</div>}
        {Array.isArray(liste) && Array.isArray(liste.enLigne) && liste.enLigne.length > 0 && <div data-refaire-en-ligne={liste.enLigne.length} style={{ fontSize: 13, color: C.muted }}>{liste.enLigne.length === 1 ? `« ${liste.enLigne[0].titre || 'Une annonce'} » est déjà en ligne sur Vinted : plus rien à refaire.` : `${liste.enLigne.length} annonces sont déjà en ligne sur Vinted : plus rien à refaire.`}</div>}
        {regles.length > 0 && <div data-refaire-regles={regles.length} style={{ fontSize: 13, color: C.muted, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>{regles.length === 1 ? 'Marqué « C’est réglé » :' : `${regles.length} marqués « C’est réglé » :`}</div>
          {regles.map((b) => <div key={b.cle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{b.titre}</span><Bouton variante="discret" data-refaire-revoir={b.id} onClick={() => revoir && revoir(b.cle)}>Remettre dans la liste</Bouton></div>)}
        </div>}
        {Array.isArray(liste) && liste.length > 0 && !peutAgir && <div data-refaire-bloque style={{ fontSize: 13, color: C.muted }}>{raisonAgir || "L'extension VRM à jour est nécessaire dans ce navigateur."}</div>}
        {Array.isArray(liste) && liste.map((b) => { const s = etat[b.cle] || {}; const fini = s.etape === 'fait'; const geste = BOUTON_REFAIRE[b.quoi]; return (
          <div key={b.cle} data-refaire-ligne={b.id} data-refaire-quoi={b.quoi} data-refaire-statut={s.etape || 'attente'} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 12, background: C.card }}>
            {b.photo ? <PhotoVinted src={b.photo} alt="" style={{ width: 48, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : null}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.titre}{b.prix ? ` · ${prixCourt(b.prix)}` : ''}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{fini ? (s.raison || 'Fait.') : s.etape && s.etape !== 'envoi' ? s.raison : TEXTE_REFAIRE[b.quoi](b)}</div>
              {s.etape === 'envoi' && <SuiviGeste ids={[b.id, b.draftId]} liste={b.quoi === 'a-publier' ? ETAPES_REPUB.publier : ETAPES_REPUB.refaire} label={b.titre} />}
              <div className="vrm-b-rangee">
                {!fini && <Bouton variante="discret" data-refaire-regle={b.id} onClick={() => ecarter(b.cle)} title="Le retirer de la liste (il reste joignable plus bas)">C'est réglé</Bouton>}
                {b.quoi === 'a-verifier' && <Bouton onClick={onVoirBrouillons} style={{ minHeight: 44 }}>Voir mes brouillons</Bouton>}
                {geste && !fini && s.etape !== 'incertain' && <Bouton data-refaire-bouton={b.id} disabled={!peutAgir || s.etape === 'envoi'} title={!peutAgir ? (raisonAgir || "L'extension VRM à jour est nécessaire dans ce navigateur.") : undefined} onClick={() => lancer(b)} style={{ minHeight: 44 }}>{s.etape === 'envoi' ? 'En cours…' : s.etape && s.etape !== 'fait' ? 'Réessayer' : geste}</Bouton>}
              </div>
            </div>
          </div>
        ); })}
      </div>
    </SheetShell>
  );
}
// ⟦← App.jsx #4⟧
function BrouillonsVinted({ br, publier, brouillonOk, onClose, onFile }) {
  const { liste: liste0, infos, nEcartes, nDisparus = 0, uidChrome, loginChrome, ecarter, remettre } = br;
  const [etat, setEtat] = useState({});            // { [id]: { etape, raison } }
  const domaine = (it) => (it && it._acc && it._acc.domain) || 'www.vinted.fr';
  const compte = (it) => (it._acc && (it._acc.login || it._acc.username)) || (it._uid ? `compte ${it._uid}` : '');
  // (2 nov.) Les brouillons du compte ouvert dans Chrome d'abord (les seuls qu'on
  // peut mettre en ligne d'ici), puis ceux des autres comptes, groupés par compte.
  const rangPlace = (b) => (String(b._uid) === String(uidChrome || '') ? 0 : 1);
  const liste = liste0 && liste0.slice().sort((a, b) => rangPlace(a) - rangPlace(b) || compte(a).localeCompare(compte(b)));
  const prixDe = (it) => { const i = it._info; const p = i && i.prix != null && i.prix !== '' ? Number(i.prix) : NaN; return p > 0 ? p : Number(it.price && typeof it.price === 'object' ? it.price.amount : it.price); };
  const mettre = async (it) => {
    const titre = (it._info && it._info.titre) || it.title || 'ce brouillon';
    const prix = prixDe(it);
    const ok = await askConfirm({ title: 'Mettre ce brouillon en ligne ?', desc: `« ${titre} »${prix > 0 ? ` à ${prixCourt(prix)}` : ''} sera publié sur Vinted, sur le compte ${compte(it) || 'de ce brouillon'}, tel que tu l'as enregistré.`, ok: 'Mettre en ligne' });
    if (!ok) return;
    setEtat((e) => ({ ...e, [it.id]: { etape: 'envoi' } }));
    let r = null; try { r = await publier(it); } catch (_) { r = null; }
    setEtat((e) => ({ ...e, [it.id]: r || { etape: 'echec', raison: "l'extension n'a pas répondu" } }));
    if (r && r.etape === 'fait') br.relire();
  };
  const lien = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', borderRadius: 12, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit', background: 'transparent', cursor: 'pointer' };
  const nPrets = liste ? liste.filter((b) => b._place === 'proposable').length : 0;
  const nomChrome = loginChrome || (uidChrome ? `compte ${uidChrome}` : '');
  return (
    <SheetShell onClose={onClose} maxWidth={560}>
      <div data-brouillons-vinted style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text, flex: 1 }}>Tes brouillons Vinted <Pourquoi label="D'où vient cette liste ?">Ceux que ton dressing Vinted montre à sa dernière lecture, et ceux enregistrés depuis, vus par l'extension. Un brouillon supprimé sur Vinted disparaît à la prochaine lecture de ce dressing.</Pourquoi></h2>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ ...lien, border: 'none' }}>✕</button>
        </div>
        {liste === null && <div style={{ fontSize: 13, color: C.muted }}>Lecture de tes annonces…</div>}

        {liste && !liste.length && <div data-brouillons-vide style={{ fontSize: 13, color: C.muted }}>Aucun brouillon sur Vinted d'après tes dressings lus par VRM.</div>}
        {liste && liste.length > 0 && <div data-brouillons-compte-chrome={uidChrome || (uidChrome === null ? 'aucun' : 'passu')} style={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{uidChrome
          ? <>Compte ouvert {NAV.dansNu} : <b style={{ color: C.text }}>{nomChrome}</b>. Seuls ses brouillons se mettent en ligne d'ici.</>
          : uidChrome === null ? `Aucun compte Vinted ouvert ${NAV.dansNu} : ouvre vinted.fr sur le compte du brouillon pour le mettre en ligne.`
          : `Compte Vinted ouvert ${NAV.dansNu} pas encore connu : ouvre vinted.fr sur le compte du brouillon pour le mettre en ligne.`}</div>}
        {infos === null && liste && liste.length > 0 && <div data-brouillons-passu style={{ fontSize: 13, color: C.muted }}>Brouillons pas lus : « Ouvrir sur Vinted » marche, « Mettre en ligne » attend.</div>}
        {!brouillonOk && liste && liste.length > 0 && <div data-brouillons-maj style={{ fontSize: 13, color: C.muted }}>Mettre en ligne d'ici demande l'extension VRM {EXT_CAPACITES.brouillon} ou plus récente.</div>}
        {brouillonOk && nPrets > 1 && onFile && <Bouton variante="primaire" data-brouillons-file onClick={onFile} style={{ alignSelf: 'flex-start', minHeight: 44 }}>En mettre plusieurs en ligne…</Bouton>}
        {liste && liste.map((it) => {
          const e = etat[it.id]; const i = it._info;
          const publie = it._etat === 'publie', complet = it._etat === 'pret';
          const place = it._place || 'a-verifier'; const proposable = place === 'proposable';
          const horsCompte = place === 'autre-compte' || place === 'compte-inconnu';
          const titre = it.title || (i && i.titre) || 'Brouillon sans titre';
          const prixAff = prixDe(it);
          return (
            <div key={it.id} data-brouillon={it.id} data-brouillon-etat={it._etat} data-brouillon-source={it._source} data-brouillon-place={place} data-brouillon-compte={it._uid || ''} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: `1px solid ${C.border}`, borderRadius: 12, background: C.card, opacity: horsCompte ? 0.6 : 1 }}>
              <div style={{ width: 56, height: 70, borderRadius: 12, overflow: 'hidden', background: C.bg, flexShrink: 0 }}>{it.photo ? <PhotoVinted src={it.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{prixAff > 0 ? `${prixCourt(prixAff)} · ` : 'sans prix · '}compte <b data-brouillon-pseudo style={{ color: C.text, fontWeight: 600 }}>{compte(it) || 'inconnu'}</b></div>
                <div data-brouillon-vu style={{ fontSize: 12, color: C.muted }}>{it._source === 'extension' ? `enregistré il y a ${ilYaBr(it._enregistre)} — pas encore relu dans ton dressing` : Number.isFinite(it._vu) ? `vu sur Vinted il y a ${ilYaBr(it._vu)}` : 'vu sur Vinted (date de lecture inconnue)'}</div>
                {e && e.etape === 'envoi' && <SuiviGeste ids={[it.id]} liste={ETAPES_REPUB.publier} label={(it._info && it._info.titre) || it.title || 'ce brouillon'} />}
                {e && e.etape === 'fait' && <div data-brouillon-fait style={{ fontSize: 13, color: C.text }}>✓ En ligne sur Vinted</div>}
                {e && e.etape && e.etape !== 'envoi' && e.etape !== 'fait' && <div data-brouillon-raison style={{ fontSize: 13, color: C.warn || C.muted }}>{e.raison || 'pas fait'}</div>}
                {!e && horsCompte && <div data-brouillon-hors-compte style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>Brouillon de {compte(it) || 'un autre compte'} — ouvre Vinted sur ce compte pour le mettre en ligne.</div>}
                {!e && place === 'a-verifier' && <div data-brouillon-a-verifier style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>À vérifier sur Vinted : ouvre ton dressing sur ce compte, jusqu'en bas. <Pourquoi label="Pourquoi ?">VRM n'a pas de lecture complète et récente (moins de 24 h) des brouillons de {compte(it) || 'ce compte'} : il a pu être supprimé ou mis en ligne depuis.</Pourquoi></div>}
                {!e && !horsCompte && place !== 'a-verifier' && publie && <div style={{ fontSize: 13, color: C.muted }}>Mis en ligne par VRM — ton dressing le montrera à la prochaine lecture.</div>}
                {!e && !horsCompte && place !== 'a-verifier' && it._etat === 'incomplet' && <div style={{ fontSize: 13, color: C.muted }}>Il lui manque {[!String((i && i.titre) || '').trim() && 'un titre', !(Number(i && i.prix) > 0) && 'un prix', !(Number(i && i.nph) > 0) && 'des photos'].filter(Boolean).join(', ')} — finis-le sur Vinted.</div>}
                {!e && !horsCompte && place !== 'a-verifier' && it._etat === 'inconnu' && <div data-brouillon-capter style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>Pas encore vu : sur Vinted, fais « Enregistrer le brouillon » sans rien changer. <Pourquoi label="Pourquoi ?">Il a été fait avant l'extension, ou ailleurs. Une fois enregistré sur Vinted, il arrive ici tout de suite, prêt à mettre en ligne.</Pourquoi></div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {proposable && complet && brouillonOk && (!e || (e.etape !== 'fait' && e.etape !== 'incertain')) && <Bouton data-brouillon-publier disabled={e && e.etape === 'envoi'} onClick={() => mettre(it)} style={{ minHeight: 44 }}>Mettre en ligne</Bouton>}
                <Bouton variante={proposable && complet && brouillonOk ? 'discret' : 'secondaire'} data-brouillon-ouvrir href={`https://${domaine(it)}/items/${it.id}/edit`} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44 }}>Ouvrir sur Vinted ↗</Bouton>
                {!e && <Bouton variante="discret" data-brouillon-ecarter onClick={() => ecarter(it.id)} title="Il n'est plus sur Vinted : le retirer de cette liste">Plus sur Vinted</Bouton>}
              </div>
            </div>
          );
        })}
        {nDisparus > 0 && <div data-brouillons-disparus={nDisparus} style={{ fontSize: 13, color: C.muted }}>{nDisparus === 1 ? 'Un brouillon n’est plus sur Vinted' : `${nDisparus} brouillons ne sont plus sur Vinted`} (absent{nDisparus > 1 ? 's' : ''} de la dernière lecture complète de leur dressing) : retiré{nDisparus > 1 ? 's' : ''} de la liste.</div>}
        {nEcartes > 0 && <div data-brouillons-ecartes={nEcartes} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.muted }}>
          <span style={{ flex: '1 1 200px' }}>{nEcartes} brouillon{nEcartes > 1 ? 's' : ''} retiré{nEcartes > 1 ? 's' : ''} de la liste (« Plus sur Vinted »).</span>
          <Bouton variante="discret" data-brouillons-remettre onClick={remettre}>Les remettre</Bouton>
        </div>}
      </div>
    </SheetShell>
  );
}
const REPUB_ESP_DEFAUT = 30;   // secondes entre deux annonces (borné par fileClamp)
// (29 oct., « approche-toi le plus possible de Vintex ») MESURÉ : Vintex enchaîne
// les paires à ~12 s d'écart. Le rythme « Comme Vintex » tire 8 à 16 s au hasard ;
// c'est le choix par défaut tant qu'il n'en a pas retenu un autre.
const REPUB_ESP_VINTEX = [8, 16];
const REPUB_REG_DEF = PHOTO_NEUTRE;   // (6 nov.) src/republierReglages.js
// (6 nov., Julien : « régler comme quand c'est VRM qui fait ») LES réglages de Republier,
// lus et écrits par l'atelier ET par « Republier à la main ». (6 nov., décision qui respecte
// la sienne du 29 oct. : « le prix ne change plus par défaut ») Seuls la PHOTO et la LETTRE
// sont gardés et synchronisés (`vrm_republier_reglages`, `reglagesGardes`) ; la baisse de
// PRIX et le TITRE repartent de « Garder » / « Ne pas changer » à chaque ouverture
// (`reglagesAOuverture`). `encours` : ceux de la même ouverture (paire suivante à la main).
// La première fois, les réglages photo que « à la main » gardait sur l'appareil
// (`vrm_main_reglages`) sont repris. `poser(patch | (courant) => patch)` : plusieurs
// poses dans le même geste s'enchaînent (le courant est tenu dans une référence).
const lireGardesStockes = (encours = null) => reglagesAOuverture(load(CLE_REGLAGES_REPUB, null), load('vrm_main_reglages', null), encours);
function useReglagesRepub(encours = null) {
  const [r, setR] = useState(() => lireGardesStockes(encours));
  const courant = React.useRef(r);
  const touche = React.useRef(false);
  // Le nuage relu (ouverture, autre appareil) ne change que ce qui est GARDÉ : le prix et le
  // titre de CETTE ouverture restent ceux qu'il est en train de choisir.
  const relire = () => { const g = lireGardesStockes(); const n = { ...courant.current, photo: g.photo, lettre: g.lettre }; courant.current = n; setR(n); };
  useEffect(() => onCloudReady(() => { if (!touche.current) relire(); }), []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (!(d && d.k === CLE_REGLAGES_REPUB && d.distant)) return; relire(); };
    window.addEventListener('vrm:save', f);
    return () => window.removeEventListener('vrm:save', f);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const poser = React.useCallback((patch) => {
    touche.current = true;
    const c = courant.current; const p = typeof patch === 'function' ? patch(c) : patch;
    const n = lireReglagesRepub({ ...c, ...(p || {}) });
    courant.current = n; setR(n);
    // Jamais un prix ni un titre dans la clé commune : ils ne survivent pas à la feuille.
    save(CLE_REGLAGES_REPUB, reglagesGardes(n));
  }, []);
  return [r, poser];
}
// ⟦← App.jsx #5⟧
// Modifier sur place : un seul geste (le PUT), que l'extension ne détaille pas.
const ETAPES_MODIF = [['envoi', 'Modification sur Vinted']];
// ⟦← App.jsx #6⟧
// (28 oct., « c'est trop long et on ne suit pas vraiment l'avancée ») Les pauses
// tirées au hasard (5.263) sont annoncées par l'extension avec leur durée (5.265) :
// on affiche ce qu'il reste à attendre, à la seconde.
const PAUSE_NOM = { photo: 'avant la photo suivante', brouillon: 'avant de créer le brouillon', enLigne: 'avant la mise en ligne', reessai: 'avant un nouvel essai' };
// (29 oct.) Vinted refuse les photos d'un brouillon : la mise en ligne se fait
// en 3 essais au plus (1. tel quel, 2. forme courte des photos, 3. photos
// renvoyées). La barre dit lequel, et la photo renvoyée en cours.
function texteSecoursPhotos(p) {
  const n = p && p.essais ? ` (essai ${p.essai} sur ${p.essais})` : '';
  if (p && p.renvoi && !p.envoye && p.total > 0) return `Vinted a refusé les photos${n} : VRM les renvoie — photo ${Math.min(p.fait + 1, p.total)} sur ${p.total}`;
  if (p && p.renvoi && p.envoye) return `Photos renvoyées : dernier essai de mise en ligne${n}`;
  if (p && p.renvoi) return `Vinted a refusé les photos${n} : VRM va les renvoyer`;
  return `Vinted a refusé les photos : nouvel essai${n}`;
}
function texteSecoursTaille(p) {
  if (p && p.envoye) return `Vinted a refusé la taille : VRM a retrouvé la taille « ${p.taille || '?'} » dans la grille de Vinted — nouvel essai`;
  return `Vinted a refusé la taille : VRM cherche la taille ${motsVendeur().de} dans la grille de Vinted`;
}
// (29 oct.) Le résultat d'une mise en ligne planifiée, lu comme celui d'une paire faite d'un trait.
function etatDeFinRepub(fin) {
  const f = fin || {};
  const etat = f.accepte && ['fait', 'double', 'incertain'].includes(f.etape) ? f.etape : (f.accepte && f.refaire) ? 'a-refaire' : 'echec';
  return { etat, raison: f.raison || (etat === 'echec' ? "la mise en ligne planifiée n'a pas abouti" : ''), nouveau: f.nouveau };
}
// (11 nov., lot suivi-travail) Le résultat d'une paire (rendu par l'extension) dit dans la feuille,
// avec le geste à faire. « Double » et « incertain » ne sont jamais « réussie » : à regarder.
function issueSuivi(s0) {
  const r = s0 && s0.raison ? String(s0.raison) : '';
  switch (s0 && s0.etat) {
    case 'fait': return { etat: 'ok' };
    case 'double': return { etat: 'main', raison: r || 'peut-être en double sur Vinted', geste: 'Regarde ton dressing Vinted et supprime le doublon s’il y en a un' };
    case 'incertain': return { etat: 'main', raison: r || 'Vinted n’a pas répondu clairement', geste: 'Regarde ton dressing Vinted avant de relancer' };
    case 'a-refaire': return { etat: 'refus', raison: r || 'brouillon pas créé', geste: 'Refais le brouillon depuis sa ligne dans Republier' };
    default:
      if (s0 && s0.code === 'plus-dans-la-liste') return { etat: 'saute', raison: r };
      if (s0 && s0.question) return { etat: 'refus', raison: r || 'il manque une information', geste: 'Réponds à la question sur sa ligne dans Republier' };
      return { etat: 'refus', raison: r || 'pas faite', geste: s0 && (s0.code === 'vinted-pause' || s0.code === 'frein-refus') ? 'Attends la fin de la pause de Vinted, puis relance' : s0 && s0.code === 'plafond' ? 'Attends que la jauge des 50 actions/heure redescende' : '' };
  }
}
function majProgRepub(p, d) {
  const id = String(d.id); const cur = p[id] || {};
  if (d.pause) return { ...p, [id]: { ...cur, pause: { quoi: String(d.pause), jusqua: Number(d.jusqua) || 0, ms: Number(d.ms) || 0 } } };
  const total = Number(d.total) || 0;
  return { ...p, [id]: { etape: String(d.etape || ''), fait: Number(d.fait) || 0, total, renvoi: !!d.renvoi, essai: Number(d.essai) || 0, essais: Number(d.essais) || 0, envoye: !!d.envoye, taille: typeof d.taille === 'string' ? d.taille.slice(0, 20) : '', nPhotos: d.etape === 'photos' && total > 0 ? total : (cur.nPhotos || 0) } };
}
function texteAttente(p, now) {
  const pa = p && p.pause;
  if (!pa || !(pa.jusqua > now)) return '';
  const s = Math.ceil((pa.jusqua - now) / 1000);
  return `pause au hasard ${PAUSE_NOM[pa.quoi] || ''} : encore ${s} s`.replace(/\s+:/, ' :');
}
// (29 oct., « tout doit être détaillé dans la barre de progression ») Chaque
// étape de la liste, dans l'ordre : ✓ faite · ● en cours (son détail : photo n
// sur N, pause au hasard et son compte à rebours, nouvel essai des photos) ·
// ○ à venir · ✗ là où ça s'est arrêté (`issue` = 'echec'). Les étapes viennent
// de l'extension (`maj · repub`) : rien n'est supposé fait sans qu'elle l'ait dit.
function DetailEtapes({ p, liste, issue, now }) {
  if (!Array.isArray(liste) || !liste.length) return null;
  const e = p && p.etape;
  let i = (e === 'secours-photos' || e === 'secours-taille') ? liste.findIndex((x) => x[0] === 'en-ligne') : liste.findIndex((x) => x[0] === e);
  if (issue === 'fait') i = liste.length;
  const att = texteAttente(p, now);
  return (
    <ol data-etapes-detail style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, lineHeight: 1.45 }}>
      {liste.map(([cle, nom], k) => {
        const etat = k < i ? 'fait' : k === i ? (issue === 'echec' ? 'echec' : 'encours') : 'avenir';
        let detail = '';
        if (etat === 'encours') {
          if (cle === 'photos' && p && p.total > 0) detail = `photo ${Math.min(p.fait + 1, p.total)} sur ${p.total}`;
          if (e === 'secours-photos') detail = texteSecoursPhotos(p);
          if (e === 'secours-taille') detail = texteSecoursTaille(p);
          if (att) detail = detail ? `${detail} · ${att}` : att;
        }
        if (etat === 'fait' && cle === 'photos' && p && p.nPhotos > 0) detail = `${p.nPhotos} photo${p.nPhotos > 1 ? 's' : ''}`;
        const signe = etat === 'fait' ? '✓' : etat === 'encours' ? '●' : etat === 'echec' ? '✗' : '○';
        return (
          <li key={cle} data-etape-detail={cle} data-etape-etat={etat} style={{ display: 'flex', gap: 6, color: etat === 'avenir' ? C.muted : etat === 'echec' ? C.warn : C.text, fontWeight: etat === 'encours' || etat === 'echec' ? 600 : 400 }}>
            <span aria-hidden="true" style={{ width: 14, flexShrink: 0, textAlign: 'center', color: etat === 'encours' ? C.accent : 'inherit' }}>{signe}</span>
            <span>{nom}{detail ? <span style={{ fontWeight: 400, color: C.muted }}> — {detail}</span> : null}{etat === 'echec' ? <span style={{ fontWeight: 400 }}> — arrêté ici</span> : null}</span>
          </li>
        );
      })}
    </ol>
  );
}
function BarreGeste({ p, liste, attrs, label, issue = null, detail = true, barre = true, replie = true }) {
  const [now, setNow] = useState(() => Date.now());
  const enPause = !!(p && p.pause && p.pause.jusqua > now);
  useEffect(() => { if (!enPause) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [enPause, p && p.pause && p.pause.jusqua]);
  useEffect(() => { setNow(Date.now()); }, [p]);
  const pe = progressionRepub(p, null, null, liste);
  const att = texteAttente(p, now);
  // (30 oct., « la barre de progression est incompréhensible ») UNE ligne dit
  // l'étape en cours (ou là où ça s'est arrêté) ; la liste des étapes (✓ ● ○ ✗)
  // reste à portée, repliée. L'attente au hasard est dite sur cette ligne, une fois.
  const e = p && p.etape;
  const iArret = Array.isArray(liste) ? ((e === 'secours-photos' || e === 'secours-taille') ? liste.findIndex((x) => x[0] === 'en-ligne') : liste.findIndex((x) => x[0] === e)) : -1;
  const ligne = issue === 'echec' ? (iArret >= 0 ? `Arrêté à l'étape « ${liste[iArret][1]} »` : 'Arrêté') : pe.texte;
  const visibleDetail = detail && !replie;
  return (
    <div {...(attrs || {})} data-geste-etape={pe.etape || 'attente'} data-geste-pause={att ? 'oui' : 'non'}>
      {barre && <div role="progressbar" aria-label={`${label ? label + ' : ' : ''}${pe.texte}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pe.part * 100)} style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ width: `${Math.max(4, Math.round(pe.part * 100))}%`, height: '100%', background: C.accent, transition: 'width .3s ease' }} />
      </div>}
      <div style={{ fontSize: 13, color: issue === 'echec' ? C.warn : C.text }}>{ligne}{att && issue !== 'echec' && !visibleDetail ? ` · ${att}` : ''}</div>
      {detail && (replie
        ? <details className="vrm-repli vrm-etapes-repli"><summary>{issue === 'echec' ? 'Voir les étapes' : `Voir les ${Array.isArray(liste) ? liste.length : ''} étapes`}</summary><DetailEtapes p={p} liste={liste} issue={issue} now={now} /></details>
        : <DetailEtapes p={p} liste={liste} issue={issue} now={now} />)}
    </div>
  );
}
// Suit un geste lancé hors de la file Republier (Refaire, Mettre en ligne).
function SuiviGeste({ ids, liste, label }) {
  const [p, setP] = useState({});
  const cles = (ids || []).filter(Boolean).map(String);
  useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && d.quoi === 'repub' && d.id && cles.includes(String(d.id))) setP((x) => majProgRepub(x, d)); };
    window.addEventListener('vrm:ext', f); return () => window.removeEventListener('vrm:ext', f);
  }, [cles.join(',')]);
  const actuel = cles.map((k) => p[k]).filter(Boolean).pop() || null;
  const lst = actuel && actuel.etape === 'en-ligne' && !(p[cles[0]] && p[cles[0]].etape) ? ETAPES_REPUB.publier : liste;
  return <BarreGeste p={actuel} liste={lst} label={label} attrs={{ 'data-suivi-geste': cles[0] || '' }} />;
}
function progressionRepub(p, action, viaB, listeImposee) {
  const liste = listeImposee || (action === 'versBrouillon' ? ETAPES_REPUB.versBrouillon : (viaB ? ETAPES_REPUB.brouillon : ETAPES_REPUB.direct));
  if (!p || !p.etape) return { etape: '', part: 0.03, texte: liste.length === 1 ? `Étape 1 sur 1 · ${liste[0][1]}…` : 'Préparation…' };
  if (p.etape === 'secours-taille') { const j = liste.findIndex((x) => x[0] === 'en-ligne'); return { etape: p.etape, part: Math.min(0.97, Math.max(0, j) / liste.length + 0.6 / liste.length), texte: texteSecoursTaille(p) + '…' }; }
  if (p.etape === 'secours-photos') { const j = liste.findIndex((x) => x[0] === 'en-ligne'); return { etape: p.etape, part: Math.min(0.97, Math.max(0, j) / liste.length + 0.5 / liste.length), texte: texteSecoursPhotos(p) + '…' }; }
  const i = liste.findIndex((x) => x[0] === p.etape);
  if (i < 0) return { etape: p.etape, part: 0.05, texte: 'En cours…' };
  const dedans = p.etape === 'photos' && p.total > 0 ? Math.min(1, p.fait / p.total) : 0;
  const part = Math.min(0.97, (i + dedans) / liste.length);
  const quoi = p.etape === 'photos' && p.total > 0 ? `Envoi de la photo ${Math.min(p.fait + 1, p.total)} sur ${p.total}` : liste[i][1];
  return { etape: p.etape, part, texte: `Étape ${i + 1} sur ${liste.length} · ${quoi}…` };
}
// ⟦← App.jsx #7⟧
// ══ REPUBLIER À LA MAIN, ACCOMPAGNÉ (5 nov. ; refait le 6 nov.) ════════════════
// Julien (5 nov.) : « l'app donne les photos modifiées (avec les réglages choisis au
// préalable), le titre, la description, tout ce qu'il faut ; une fois republiée
// à la main, l'app remet le N° sur la nouvelle annonce ». (6 nov.) « je veux que on
// puisse régler comme quand c'est VRM qui fait, pareil améliore l'interface ».
// Rien ne part chez Vinted d'ici. Les RÉGLAGES sont ceux de l'atelier Republier
// (`useReglagesRepub`, synchronisés) et chaque valeur copiée sort de LA règle de
// l'atelier (`annonceRepubliee` → `apercuRepub`, la lettre, puis le N° posé selon
// `vrm_num_vinted`) ; chaque photo, du MÊME dessin (`dessinerPhotoReglee`).
// Cinq étapes numérotées (Réglages · Photos · Texte · Mettre en ligne · Relier), la
// progression en tête ; plusieurs paires : une à la fois (« paire 2/5 », Suivante).
// Le N° : SON clic désigne la nouvelle annonce (une identité, jamais un titre) ; la
// reprise est la règle des republications (`repriseNumerosRecreation`) — elle attend
// que l'ancienne ne soit plus du tout sur Vinted.
// `l` : le mot court de la progression (cinq tiennent sur 390 px) ; `t` : le titre de l'étape.
const ETAPES_MAIN = [
  { k: 'reglages', l: 'Réglages', t: 'Réglages' },
  { k: 'photos', l: 'Photos', t: 'Photos' },
  { k: 'texte', l: 'Texte', t: 'Texte à copier' },
  { k: 'vinted', l: 'Vinted', t: 'Mettre en ligne sur Vinted' },
  { k: 'relier', l: 'Relier', t: 'Relier la nouvelle annonce' },
];
const lireEtiquetteVinted = () => lireReglageEtiquette(load(CLE_REGLAGE_ETIQUETTE, null));
// iPhone : le menu de partage avec des FICHIERS (« Enregistrer les images ») ; ailleurs, le téléchargement.
const peutPartagerFichiers = (files) => { try { return !!(typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files })); } catch (_) { return false; } };
const partageFichiersPossible = () => { try { return !!(typeof navigator !== 'undefined' && navigator.share && navigator.canShare); } catch (_) { return false; } };
// Le prix à COLLER dans Vinted (« 44,10 », « 49 ») — jamais « 0 » pour un prix pas lu.
const prixACopier = (p) => (p == null || !(Number(p) > 0) ? '' : (Number.isInteger(Number(p)) ? String(Number(p)) : Number(p).toFixed(2).replace('.', ',')));
function RepublierALaMain({ paire, suivi, candidats, etatSuivi, onDebut, onLier, onDelier, onRelire, onClose, rang = null, onSuivante = null, encours = null }) {
  const [fiche, setFiche] = useState(undefined);   // undefined lecture · null pas su · objet lu (vide si rien rangé)
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        if (!/^\d{1,15}$/.test(String(paire.uid || '')) || !/^\d{4,15}$/.test(String(paire.id || ''))) { if (vivant) setFiche({}); return; }
        const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.coffre_${paire.uid}_${paire.id}&select=title:data->>title,desc:data->>desc,brand:data->>brand,size:data->>size,etat:data->>etat,price:data->>price,photos:data->photos`, { headers: sbAuth() });
        if (!r.ok) throw new Error('lecture');
        const j = await r.json(); if (!Array.isArray(j)) throw new Error('forme');
        if (vivant) setFiche(j[0] || {});
      } catch (_) { if (vivant) setFiche(null); }
    })();
    return () => { vivant = false; };
  }, [paire.uid, paire.id]);
  // LES réglages de l'atelier (une source) et l'endroit du N° (Réglages → Numéros).
  const [regs, poserRegs] = useReglagesRepub(encours);
  const [etq, setEtq] = useState(lireEtiquetteVinted);
  useEffect(() => {
    const f = () => setEtq(lireEtiquetteVinted());
    const off = onCloudReady(f);
    window.addEventListener('vrm-num-vinted', f);
    const g = (e) => { const d = e && e.detail; if (d && d.k === CLE_REGLAGE_ETIQUETTE) f(); };
    window.addEventListener('vrm:save', g);
    return () => { if (typeof off === 'function') off(); window.removeEventListener('vrm-num-vinted', f); window.removeEventListener('vrm:save', g); };
  }, []);
  const [lettre] = useState(() => tirerLettre());   // une lettre par paire (comme l'atelier)
  const [etape, setEtape] = useState(() => (suivi ? 'relier' : 'reglages'));
  const [vues, setVues] = useState(() => new Set());
  const [ouvert, setOuvert] = useState(!!suivi);
  const [copies, setCopies] = useState(() => new Set());
  const [copie, setCopie] = useState('');
  const presets = (() => { const p = load('vrm_photo_presets', []); return Array.isArray(p) ? p.filter((x) => x && x.nom && x.r) : []; })();
  const f = fiche || {};
  const photos = (Array.isArray(f.photos) && f.photos.length ? f.photos : (paire.photo ? [paire.photo] : [])).map((p) => (typeof p === 'string' ? p : (p && (p.url || p.full_size_url)) || '')).filter(Boolean).slice(0, 20);
  const prixLu = f.price != null && f.price !== '' && Number(f.price) > 0 ? Number(f.price) : (paire.prix != null && Number(paire.prix) > 0 ? Number(paire.prix) : null);
  const titreLu = String(f.title || paire.titre || '');
  // L'annonce TELLE QU'ELLE PARTIRA : la règle de l'atelier, puis le N° (src/republierReglages.js).
  const ann = annonceRepubliee({ titre: titreLu, description: String(f.desc || ''), prix: prixLu, floor: paire.floor, numero: paire.numero }, regs, { lettre, etiquette: etq });
  const marque = String(f.brand || paire.marque || ''), taille = String(f.size || paire.taille || ''), etatA = String(f.etat || paire.condition || '');
  const placeN = (PLACES_ETIQUETTE.find((x) => x.v === etq.place) || PLACES_ETIQUETTE[0]);
  const cssPh = { width: '100%', height: '100%', objectFit: 'cover', ...cssApercuPhoto(regs.photo) };
  const aller = (k) => { setVues((v) => new Set(v).add(etape)); setEtape(k); };
  const iE = ETAPES_MAIN.findIndex((x) => x.k === etape);
  const copier = async (k, t) => {
    try { await navigator.clipboard.writeText(String(t || '')); setCopie(k); setCopies((s) => new Set(s).add(k)); setTimeout(() => setCopie((c) => (c === k ? '' : c)), 1600); }
    catch (_) { toast('Copie impossible ici : sélectionne le texte et copie-le.'); }
  };
  // ── Les photos : le MÊME dessin que l'atelier (`dessinerPhotoReglee`), une par une (`usePhotosReglees`, plus bas).
  const nPh = photos.length;
  const { ph, pretes, enregistrer, enregistrerUne, libelle: libellePhotos } = usePhotosReglees(photos, regs.photo, paire.numero);
  // ── Ce qui est fait (la progression en tête) : un geste fait, jamais deviné.
  const champsTexte = [['titre', ann.titre], ['description', ann.description], ['prix', prixACopier(ann.prix)]].filter(([, v]) => v);
  const fait = {
    reglages: vues.has('reglages'),
    photos: !!(ph && (ph.enregistre || (ph.fait > 0 && ph.unes && ph.unes.size >= ph.fait))),
    texte: champsTexte.length > 0 && champsTexte.every(([k]) => copies.has(k)),
    vinted: ouvert,
    relier: etatSuivi === 'lie' || etatSuivi === 'fait',
  };
  const nFait = ETAPES_MAIN.filter((x) => fait[x.k]).length;
  // ── Les réglages (les MÊMES que l'atelier : listes et bornes de src/republierReglages.js).
  const p = regs.prix, modeT = regs.titre.mode;
  const rapide = p.base === 'pct' && REDUCTIONS_RAPIDES.includes(String(p.delta).trim());
  const choixPrix = (v) => poserRegs((c) => (v === 'aucun' ? { prix: { ...c.prix, base: 'aucun' } }
    : v === 'autre' ? (c.prix.base === 'aucun' || (c.prix.base === 'pct' && REDUCTIONS_RAPIDES.includes(String(c.prix.delta).trim())) ? { prix: { ...c.prix, base: 'pct', delta: '' } } : {})
    : { prix: { ...c.prix, base: 'pct', delta: v } }));
  const regNeutre = photoNeutre(regs.photo);
  const neutreTout = regNeutre && !prixChange(regs) && !titreChange(regs) && !regs.lettre;
  const champCopiable = (k, lab, val, vide, multi = false) => (
    <div className="vrm-rm-champ" data-main-champ={k} data-main-copie={copies.has(k) ? '1' : undefined} data-main-vide={val ? undefined : '1'}>
      <div className="vrm-rm-champ-tete">
        <span>{lab}</span>
        {val ? <Bouton variante={copies.has(k) ? 'discret' : 'secondaire'} icone={copie === k ? 'check' : 'copy'} data-main-copier={k} aria-label={`Copier ${lab.toLowerCase()}`} onClick={() => copier(k, val)}>{copie === k ? 'Copié' : copies.has(k) ? 'Recopier' : 'Copier'}</Bouton> : null}
      </div>
      <div className={`vrm-main-valeur${multi ? ' vrm-rm-multi' : ''}`}>{val || <span className="vrm-rm-muet">{vide}</span>}</div>
    </div>
  );
  const nouvelleUrl = `https://${paire.domain || 'www.vinted.fr'}/items/new`;
  const nomNouvelle = suivi && suivi.nouvelId ? (((candidats || []).find((c) => String(c.id) === String(suivi.nouvelId)) || {}).titre || suivi.nouveauTitre || '') : '';
  const numVu = paire.numero || paire.numAffiche || '';
  const derniere = !rang || rang.i >= rang.n - 1;
  const suivante = ETAPES_MAIN[iE + 1];
  const section = (k, enfants) => { const i = ETAPES_MAIN.findIndex((x) => x.k === k); return <section className="vrm-rm-section" data-main-section={k} hidden={etape !== k} aria-labelledby={`vrm-rm-t-${k}`}><h3 className="vrm-rm-titre" id={`vrm-rm-t-${k}`}>{i + 1}. {ETAPES_MAIN[i].t}</h3>{enfants}</section>; };
  return (
    <SheetShell onClose={onClose} maxWidth={600} className="vrm-rm-feuille" titre={paire.annulee ? 'Remettre en vente' : 'Republier à la main'}
      sousTitre={rang ? `${motsVendeur().Nom} ${rang.i + 1}/${rang.n}` : undefined}
      data-repub-main={paire.id} data-repub-main-etat={etatSuivi} data-main-etape={etape} data-main-rang={rang ? `${rang.i + 1}/${rang.n}` : undefined}>
      {/* La paire : son N°, son titre, son compte — une fois, en tête. */}
      <div className="vrm-rm-paire">
        <span className="vrm-rm-paire-photo">{photos[0] ? <PhotoVinted src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <PhotoVide remplir/>}</span>
        <div className="vrm-rm-paire-texte">
          <div className="vrm-rm-paire-nom">{numVu ? <Numero n={numVu} data-main-num={numVu}/> : null}<span>{titreLu || 'Annonce sans titre'}</span></div>
          <div className="vrm-rm-paire-sous">Compte <b>{paire.compte}</b> · tu publies toi-même, rien ne part d’ici</div>
        </div>
      </div>
      {/* La progression : cinq étapes, la courante pleine, une étape FAITE cochée. */}
      <ol className="vrm-rm-etapes" aria-label={`Étape ${iE + 1} sur ${ETAPES_MAIN.length}`} data-main-fait={nFait}>
        {ETAPES_MAIN.map((x, i) => (
          <li key={x.k}>
            <button type="button" className="vrm-rm-etape" data-main-aller={x.k} data-main-etape-fait={fait[x.k] ? '1' : undefined} aria-current={etape === x.k ? 'step' : undefined} onClick={() => aller(x.k)}>
              <span className="vrm-rm-pastille" aria-hidden="true">{fait[x.k] && etape !== x.k ? <Icon name="check" size={13}/> : i + 1}</span>
              <span className="vrm-rm-etape-mot">{x.l}</span>
            </button>
          </li>
        ))}
      </ol>
      {fiche === undefined && <div className="vrm-rm-muet" data-main-lecture="">Lecture de ce que VRM a enregistré…</div>}
      {fiche === null && <div className="vrm-rm-note" data-main-passu="">Fiche pas lue : titre et prix du dressing, description manquante.</div>}

      {section('reglages', <>
        <div className="vrm-rm-memes" data-main-memes-reglages={resumeGardes(regs).join(' · ')}>
          <b>Mêmes réglages que Republier.</b> Prix et titre repartent de « Garder ». <Pourquoi>La retouche des photos et la lettre valent aussi quand VRM republie pour toi, et l’inverse, sur tous tes appareils. Le prix et le titre repartent de « Garder » à chaque ouverture{rang ? ` (ils valent pour ${motsVendeur().toutes} les ${motsVendeur().noms} de cette série)` : ''}.</Pourquoi>
        </div>
        <div className="vrm-rm-bloc" data-main-bloc="photos">
          <div className="vrm-rm-bloc-tete"><b>Photos</b><span>{regNeutre ? 'telles quelles' : 'retouchées'} · vaut pour toutes</span></div>
          {nPh ? <div className="vrm-rm-bande" data-main-apercu-photos={nPh}>{photos.slice(0, 4).map((u, i) => <div key={i} className="vrm-rm-vignette"><PhotoVinted src={u} alt="" style={cssPh}/></div>)}{nPh > 4 ? <div className="vrm-rm-vignette vrm-rm-plus">+{nPh - 4}</div> : null}</div> : null}
          {presets.length > 0 && <div className="vrm-rm-puces">{presets.map((x) => <Bouton key={x.nom} variante="secondaire" data-main-preset={x.nom} onClick={() => poserRegs({ photo: { ...PHOTO_NEUTRE, ...x.r } })}>{x.nom}</Bouton>)}</div>}
          <details className="vrm-repli" data-main-reglages="">
            <summary>{regNeutre ? 'Retoucher (redresser, lumière, contraste…)' : 'Modifier la retouche'}</summary>
            {CURSEURS_PHOTO.map((c) => (
              <label key={c.cle} className="vrm-rm-curseur">
                <span>{c.l}</span>
                <input type="range" min={c.min} max={c.max} step={c.pas} value={regs.photo[c.cle]} data-main-reglage={c.cle} onChange={(ev) => { const v = Number(ev.target.value); poserRegs((x) => ({ photo: { ...x.photo, [c.cle]: v } })); }}/>
                <span className="vrm-rm-val">{c.cle === 'rot' ? `${regs.photo.rot}°` : `${Math.round(regs.photo[c.cle] * 100)}\u00a0%`}</span>
              </label>
            ))}
            {!regNeutre && <Bouton variante="discret" data-main-neutre="" onClick={() => poserRegs({ photo: { ...PHOTO_NEUTRE } })}>Photos d’origine</Bouton>}
          </details>
        </div>
        <div className="vrm-rm-bloc" data-main-bloc="prix">
          <div className="vrm-rm-bloc-tete"><b>Prix</b><span>jamais sous le prix d’achat</span></div>
          <div className="vrm-filtres vrm-rm-puces" role="group" aria-label="Baisse du prix">
            {[['aucun', 'Garder'], ...REDUCTIONS_RAPIDES.map((v) => [v, `−${v.slice(1)}\u00a0%`]), ['autre', 'Autre…']].map(([v, l]) => {
              const actif = v === 'aucun' ? p.base === 'aucun' : v === 'autre' ? (p.base !== 'aucun' && !rapide) : (p.base === 'pct' && String(p.delta).trim() === v);
              return <button key={v} type="button" data-main-reduc={v} aria-pressed={actif} onClick={() => choixPrix(v)}>{l}</button>;
            })}
          </div>
          {p.base !== 'aucun' && !rapide && <div className="vrm-rm-ligne">
            <select value={p.base} aria-label="Type de baisse" data-main-prix-type="" onChange={(ev) => { const v = ev.target.value; poserRegs((c) => ({ prix: { ...c.prix, base: v } })); }}>
              <option value="pct">Baisser d’un pourcentage</option>
              <option value="fixe">Baisser d’un montant en&nbsp;€</option>
              <option value="commun">Mettre toutes au même prix</option>
            </select>
            {(p.base === 'pct' || p.base === 'fixe') && <input value={String(p.delta).replace(/^-/, '')} inputMode="decimal" data-main-delta="" placeholder={p.base === 'pct' ? 'ex. 12 (= −12\u00a0%)' : 'ex. 5 (= −5\u00a0€)'} aria-label={p.base === 'pct' ? 'Baisse en %' : 'Baisse en\u00a0€'} onChange={(ev) => { const v = ev.target.value.replace(/[^0-9.,]/g, ''); poserRegs((c) => ({ prix: { ...c.prix, delta: v ? '-' + v : '' } })); }}/>}
            {p.base === 'commun' && <input value={p.commun} inputMode="decimal" data-main-commun="" placeholder="Prix (€)" aria-label="Prix pour toutes" onChange={(ev) => { const v = ev.target.value; poserRegs((c) => ({ prix: { ...c.prix, commun: v } })); }}/>}
          </div>}
          {p.base !== 'aucun' && <label className="vrm-rm-case"><input type="checkbox" data-main-arrondi="" checked={p.arrondi === 'euro'} onChange={(ev) => { const on = ev.target.checked; poserRegs((c) => ({ prix: { ...c.prix, arrondi: on ? 'euro' : 'aucun', fin: 'aucune' } })); }}/><span>Arrondir à l’euro (44,10&nbsp;€ → 44&nbsp;€)</span></label>}
          <div className="vrm-rm-resultat" data-main-prix-resultat={ann.prix != null ? Math.round(ann.prix * 100) : ''}>
            {ann.prixAvant == null ? <span className="vrm-rm-muet">Prix pas lu par VRM : reprends celui de l’annonce sur Vinted.</span>
              : ann.prix !== ann.prixAvant ? <>{montant(ann.prixAvant)} → <b>{montant(ann.prix)}</b>{ann.plancher ? <span className="vrm-rm-ambre"> · ramené à ton prix d’achat</span> : null}</>
              : <>{montant(ann.prix)} · inchangé</>}
          </div>
        </div>
        <div className="vrm-rm-bloc" data-main-bloc="titre">
          <div className="vrm-rm-bloc-tete"><b>Titre</b><span>jamais coupé</span></div>
          <select value={modeT} aria-label="Changer le titre" data-main-titre-mode="" onChange={(ev) => { const v = ev.target.value; poserRegs((c) => ({ titre: { ...c.titre, mode: v } })); }}>
            {MODES_TITRE.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          {(modeT === 'remplacer' || modeT === 'supprimer') && <input value={regs.titre.chercher} placeholder="Texte à trouver" aria-label="Texte à trouver" onChange={(ev) => { const v = ev.target.value; poserRegs((c) => ({ titre: { ...c.titre, chercher: v } })); }}/>}
          {(modeT === 'prefixe' || modeT === 'suffixe' || modeT === 'remplacer') && <input value={regs.titre.valeur} placeholder={modeT === 'remplacer' ? 'Par' : 'Texte à ajouter'} aria-label="Texte" data-main-titre-valeur="" onChange={(ev) => { const v = ev.target.value; poserRegs((c) => ({ titre: { ...c.titre, valeur: v } })); }}/>}
          {(titreChange(regs) || ann.etiquette.pose && etq.place.startsWith('titre')) && <div className="vrm-rm-resultat" data-main-titre-resultat="">{ann.titre || <span className="vrm-rm-muet">titre vide</span>}{ann.tropLong ? <span className="vrm-rm-ambre"> · {ann.titre.length}/{TITRE_VINTED_MAX} : Vinted le refusera, raccourcis-le</span> : null}</div>}
        </div>
        <div className="vrm-rm-bloc" data-main-bloc="description">
          <div className="vrm-rm-bloc-tete"><b>Description</b><span>reprise mot pour mot</span></div>
          <label className="vrm-rm-case"><input type="checkbox" data-main-lettre="" checked={regs.lettre} onChange={(ev) => { const on = ev.target.checked; poserRegs({ lettre: on }); }}/><span>Ajouter une lettre au hasard tout en bas{regs.lettre ? <> (ici : « {lettre} »)</> : null}</span></label>
          <div className="vrm-rm-muet" data-main-etiquette={ann.etiquette.pose ? ann.etiquette.place : (ann.etiquette.refus ? 'refus' : 'aucune')}>
            {etq.place === 'aucune' ? 'Le N° n’est pas écrit dans l’annonce (Paramètres → Numéros).'
              : ann.etiquette.pose ? <>Le N° « {ann.etiquette.texte} » est posé {placeN.ou} (Paramètres → Numéros).</>
              : ann.etiquette.refus === 'pas de numéro' ? `${motsVendeur().Ce} n’a pas de N° à écrire dans l’annonce.`
              : <span className="vrm-rm-ambre">N° pas posé : {ann.etiquette.refus}.</span>}
          </div>
        </div>
        {!neutreTout && <Bouton variante="discret" data-main-reglages-zero="" onClick={() => poserRegs(lireReglagesRepub(null))}>Tout remettre à zéro</Bouton>}
      </>)}

      {section('photos', <>
        {/* (10 nov., lot AP — demande 17) Une photo PRÉPARÉE s'enregistre aussi seule (son bouton sur la vignette). */}
        {nPh ? <div className="vrm-main-photos" data-main-photos={nPh}>{photos.map((u, i) => <div key={i} className="vrm-rm-photo">
          <PhotoVinted src={u} alt={`Photo ${i + 1}`} style={cssPh}/>
          {pretes && ph.parIndice[i] ? <button type="button" className="vrm-rm-photo-une" data-main-photo-une={i} data-main-photo-une-fait={ph.unes.has(i) ? '1' : undefined} aria-label={`Enregistrer la photo ${i + 1}`} onClick={() => enregistrerUne(i)}><Icon name={ph.unes.has(i) ? 'check' : 'save'} size={18}/></button> : null}
        </div>)}</div>
          : <div className="vrm-rm-note" data-main-sans-photo="">VRM n’a aucune photo de cette annonce : ouvre-la sur Vinted pour qu’il les lise.</div>}
        {nPh > 0 && <>
          <p className="vrm-rm-muet">{regNeutre ? 'Les photos telles qu’enregistrées' : 'Les photos avec ta retouche (Réglages)'}, nommées {nomPhotoReglee(paire.numero, 0)}{nPh > 1 ? `, ${nomPhotoReglee(paire.numero, 1)}${nPh > 2 ? '…' : ''}` : ''}.{partageFichiersPossible() ? ' Sur iPhone : « Enregistrer les images » les met dans Photos.' : ''}{pretes ? ' Ou une seule : son bouton sur la photo.' : ''}</p>
          <div className="vrm-b-rangee vrm-rm-gauche"><Bouton variante={pretes && !ph.enregistre ? 'primaire' : 'secondaire'} icone="image" data-main-telecharger={nPh} occupe={!!(ph && ph.encours)} disabled={!!(ph && ph.encours)} onClick={enregistrer}>{libellePhotos}</Bouton></div>
        </>}
        {ph && !ph.encours && <div className="vrm-rm-muet" data-main-dl-fait={ph.fait} data-main-dl-rate={ph.rate} role="status">
          {ph.enregistre === 'partage' ? `${ph.fait} photo${ph.fait > 1 ? 's' : ''} envoyée${ph.fait > 1 ? 's' : ''} au menu de partage` : ph.enregistre ? `${ph.fait} photo${ph.fait > 1 ? 's' : ''} téléchargée${ph.fait > 1 ? 's' : ''}` : `${ph.fait} photo${ph.fait > 1 ? 's' : ''} prête${ph.fait > 1 ? 's' : ''}`}
          {ph.rate ? <span className="vrm-rm-ambre"> · {ph.rate} pas lue{ph.rate > 1 ? 's' : ''} (réessaie, ou enregistre-la depuis Vinted)</span> : null}.
        </div>}
      </>)}

      {section('texte', <>
        {/* L'annonce telle qu'elle partira : la règle de l'atelier, le N° posé. */}
        <article className="vrm-rm-apercu" data-main-apercu="" data-main-prix-final={ann.prix != null ? Math.round(ann.prix * 100) : ''}>
          <div className="vrm-rm-apercu-photo">{photos[0] ? <PhotoVinted src={photos[0]} alt="" style={cssPh}/> : <PhotoVide remplir/>}{nPh > 1 ? <span className="vrm-rm-apercu-n">1/{nPh}</span> : null}</div>
          <div className="vrm-rm-apercu-corps">
            <div className="vrm-rm-apercu-prix">{ann.prix != null ? <>{montant(ann.prix)}{ann.prix !== ann.prixAvant && ann.prixAvant != null ? <s>{montant(ann.prixAvant)}</s> : null}</> : <span className="vrm-rm-muet">prix pas lu</span>}</div>
            <div className="vrm-rm-apercu-titre">{ann.titre || 'Sans titre'}</div>
            <div className="vrm-rm-apercu-sous">{[marque, taille, etatA].filter(Boolean).join(' · ') || 'marque, taille, état : pas lus'}</div>
            <div className="vrm-rm-apercu-desc" data-main-apercu-desc="">{ann.description || <span className="vrm-rm-muet">Pas de description enregistrée.</span>}</div>
          </div>
        </article>
        <p className="vrm-rm-muet">Touche « Copier », puis colle dans Vinted. {champsTexte.length ? `${champsTexte.filter(([k]) => copies.has(k)).length} sur ${champsTexte.length} copiés.` : ''}</p>
        {champCopiable('titre', 'Titre', ann.titre, 'pas lu')}
        {champCopiable('description', 'Description', ann.description, 'VRM n’a pas la description : copie-la depuis l’annonce sur Vinted.', true)}
        {champCopiable('prix', 'Prix (€)', prixACopier(ann.prix), 'pas lu : reprends celui de l’annonce sur Vinted')}
        <div className="vrm-rm-trio">
          {champCopiable('marque', 'Marque', marque, 'pas lue')}
          {champCopiable('taille', 'Taille', taille, 'pas lue')}
          {champCopiable('etat', 'État', etatA, 'pas lu')}
        </div>
      </>)}

      {section('vinted', <>
        <ol className="vrm-rm-liste">
          <li>Sur Vinted, connecté sur <b>{paire.compte}</b> : « Vendre ».</li>
          <li>Ajoute les {nPh || ''} photo{nPh > 1 ? 's' : ''} enregistrée{nPh > 1 ? 's' : ''}{fait.photos ? '' : <span className="vrm-rm-ambre"> (pas encore enregistrées : étape 2)</span>}.</li>
          <li>Colle le titre, la description, le prix{fait.texte ? '' : <span className="vrm-rm-ambre"> (pas tout copié : étape 3)</span>}.</li>
          <li>Choisis {[marque, taille, etatA].filter(Boolean).join(' · ') || 'la marque, la taille et l’état'}, puis « Ajouter ».</li>
        </ol>
        <div className="vrm-b-rangee vrm-rm-gauche"><Bouton variante="primaire" data-main-ouvrir-vinted="" href={nouvelleUrl} target="_blank" rel="noopener noreferrer" onClick={() => { onDebut(); setOuvert(true); setVues((v) => new Set(v).add('vinted')); setEtape('relier'); }}>Ouvrir Vinted — nouvelle annonce ↗</Bouton></div>
        {/* (6 nov., vague 2 · point 1) Une vente annulée avant l'envoi : l'ancienne annonce est FERMÉE
            chez Vinted (vendue puis annulée, mesuré) — rien à supprimer, jamais deux fois en vente. */}
        {paire.annulee
          ? <div className="vrm-rm-muet" data-main-annulee={paire.tx || ''}>L’ancienne annonce est fermée chez Vinted (vente annulée) : rien à supprimer.</div>
          : <div className="vrm-rm-note">Nouvelle en ligne : supprime l’ancienne sur Vinted, sinon double vente.</div>}
      </>)}

      {section('relier', <>
        {paire.numero && etatSuivi !== 'fait' ? <p className="vrm-rm-muet" data-main-but="">Le N°{paire.numero} passera sur la nouvelle annonce : le même rangement.</p> : null}
        {paire.annulee && !paire.numero && etatSuivi !== 'fait' ? <div className="vrm-rm-muet" data-main-num-neuf={paire.archive ? 'archive' : 'sans'}>{paire.archive ? `Le N°${paire.numAffiche} est un ancien numéro : il ne se redonne pas. La nouvelle annonce recevra un N° neuf, à écrire là où l’article est rangé.` : `${motsVendeur().Nom} pas relié${motsVendeur().e} : cette vente n’a pas de N°. La nouvelle annonce en recevra un, comme toute annonce.`}</div> : null}
        {paire.annulee && !paire.numero && etatSuivi === 'fait' ? <div className="vrm-rm-fait" data-main-n-fait=""><Icon name="check" size={16}/> Nouvelle annonce désignée : la vente annulée est remise en vente.</div>
          : !paire.numero && !paire.annulee ? <div className="vrm-rm-muet" data-main-sans-num="">Cette annonce n’a pas de N° : la nouvelle en recevra un, comme toute annonce.</div>
          : etatSuivi === 'fait' ? <div className="vrm-rm-fait" data-main-n-fait=""><Icon name="check" size={16}/> La nouvelle annonce porte le N°{paire.numero}.</div>
          : etatSuivi === 'lie' ? <div className="vrm-rm-lie" data-main-lie={suivi.nouvelId}>
              <span>Nouvelle annonce désignée{nomNouvelle ? ` : « ${nomNouvelle} »` : ''}. {paire.annulee ? `Le N°${paire.numero} passe dessus à la prochaine lecture de tes annonces.` : `Le N°${paire.numero} passe dessus dès que l’ancienne n’est plus du tout sur Vinted — ni en ligne, ni masquée, ni en brouillon (supprime-la sur Vinted, puis rouvre Annonces).`}</span>
              <div className="vrm-b-rangee vrm-rm-gauche"><Bouton variante="discret" data-main-delier="" onClick={onDelier}>Ce n’est pas elle</Bouton></div>
            </div>
          : <>
              <div className="vrm-rm-muet">{ouvert ? 'Une fois publiée, choisis-la ici : c’est toi qui la désignes, VRM ne devine pas.' : 'Publie d’abord la nouvelle annonce (étape 4), puis choisis-la ici : c’est toi qui la désignes, VRM ne devine pas.'}</div>
              {(candidats || []).length ? <ul className="vrm-sel-liste" data-main-candidats={candidats.length}>{candidats.slice(0, 12).map((c) => (
                <li key={c.id}><div className="vrm-sel-ligne" style={{ cursor: 'default' }} data-main-candidat={c.id}>
                  <span className="vrm-sel-photo vrm-rm-cadre">{c.photo ? <PhotoVinted src={c.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <PhotoVide remplir/>}</span>
                  <span className="vrm-sel-centre"><span className="vrm-sel-nom">{c.titre || 'Sans titre'}</span><span className="vrm-sel-sous">{c.prix != null ? montant(c.prix) : 'sans prix'}{c.numero ? ` · N°${c.numero} (auto)` : ''}</span></span>
                  <Bouton variante="secondaire" icone="link" data-main-lier={c.id} onClick={() => onLier(c)}>C’est celle-ci</Bouton>
                </div></li>))}</ul>
                : <div className="vrm-rm-muet" data-main-aucun-candidat="">Aucune nouvelle annonce de {paire.compte} lue depuis que tu as commencé.</div>}
              <div className="vrm-b-rangee vrm-rm-gauche"><Bouton variante="discret" data-main-relire="" onClick={onRelire}>Relire mes annonces</Bouton></div>
            </>}
      </>)}

      {/* Le pied : revenir, aller à l'étape suivante ; à la dernière, la paire suivante. */}
      <div className="vrm-rm-pied">
        {iE > 0 ? <Bouton variante="discret" data-main-retour="" onClick={() => aller(ETAPES_MAIN[iE - 1].k)}>Retour</Bouton> : <span/>}
        {suivante ? <Bouton variante={suivante.k === 'relier' ? 'secondaire' : 'primaire'} data-main-suivant={suivante.k} onClick={() => aller(suivante.k)}>{`Suivant : ${suivante.l}`}</Bouton>
          : !derniere && onSuivante ? <Bouton variante="primaire" data-main-suivante={`${rang.i + 2}/${rang.n}`} onClick={() => onSuivante({ prix: regs.prix, titre: regs.titre })}>{`${motsVendeur().Nom} suivant${motsVendeur().e} · ${rang.i + 2}/${rang.n}`}</Bouton>
          : <Bouton variante={fait.relier ? 'primaire' : 'secondaire'} data-main-terminer="" onClick={onClose}>{fait.relier ? 'Terminer' : 'Fermer'}</Bouton>}
      </div>
    </SheetShell>
  );
}
// (10 nov., lot AP) LES PHOTOS RÉGLÉES D'UNE PAIRE, prêtes pour la galerie du téléphone : une
// source pour « Republier à la main » (pas à pas) et « Préparer plusieurs » (le kit). Le MÊME dessin
// que l'atelier (`dessinerPhotoReglee`) ; un réglage changé les refait. Toutes d'un coup
// (`enregistrer`) ou une seule (`enregistrerUne`) : iPhone ⇒ le menu de partage avec des FICHIERS
// (« Enregistrer les images » les met dans Photos), ouvert DANS le geste (Safari l'exige : préparer,
// puis toucher « Enregistrer ») ; ailleurs, le téléchargement `VRM-{N°}-01.jpg…`.
function usePhotosReglees(photos, reglage, numero) {
  const [ph, setPh] = useState(null);   // { fichiers, parIndice, unes, fait, rate, total, encours, enregistre, pour }
  const clePhoto = JSON.stringify(reglage);
  useEffect(() => { setPh((p) => (p && p.pour !== clePhoto ? null : p)); }, [clePhoto]);
  const preparer = async () => {
    const total = photos.length, pour = clePhoto, r = reglage; const fichiers = []; const parIndice = []; let rate = 0;
    setPh({ fichiers: [], parIndice: [], unes: new Set(), fait: 0, rate: 0, total, encours: true, pour });
    for (let i = 0; i < total; i++) {
      try {
        const data = await chargerPhotoBoite(photos[i]);
        if (!data) throw new Error('pas lue');
        const img = new Image(); img.src = data; await img.decode();
        const w = img.naturalWidth, h = img.naturalHeight;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (dessinerPhotoReglee(ctx, img, w, h, r) === 'pixels') { ctx.setTransform(1, 0, 0, 1, 0, 0); const id = ctx.getImageData(0, 0, w, h); appliquerCouleursPixels(id.data, r); ctx.putImageData(id, 0, 0); }
        const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
        if (!blob) throw new Error('toile');
        const fi = new File([blob], nomPhotoReglee(numero, i), { type: 'image/jpeg' });
        fichiers.push(fi); parIndice[i] = fi;
      } catch (_) { rate++; parIndice[i] = null; }
      setPh({ fichiers: fichiers.slice(), parIndice: parIndice.slice(), unes: new Set(), fait: fichiers.length, rate, total, encours: i < total - 1, pour });
    }
    return fichiers;
  };
  const telecharger = (fichiers) => fichiers.forEach((fi) => { const u = URL.createObjectURL(fi); const a = document.createElement('a'); a.href = u; a.download = fi.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); });
  const pretes = !!(ph && !ph.encours && ph.pour === clePhoto && ph.fichiers.length > 0);
  const envoyer = async (files, titre) => {
    if (peutPartagerFichiers(files)) {
      try { await navigator.share({ files, title: titre }); return 'partage'; }
      catch (e) { if (e && e.name === 'AbortError') return ''; }
    }
    telecharger(files); return 'telecharge';
  };
  const titre = numero ? `N°${numero}` : 'Photos';
  const enregistrer = async () => {
    if (pretes) { const m = await envoyer(ph.fichiers, titre); if (m) setPh((p) => ({ ...p, enregistre: m })); return; }
    const fichiers = await preparer();
    if (!fichiers.length) return;
    // Partage possible : le bouton dit maintenant « Enregistrer » — un second toucher ouvre le menu.
    if (peutPartagerFichiers(fichiers)) return;
    telecharger(fichiers); setPh((p) => ({ ...p, enregistre: 'telecharge' }));
  };
  const enregistrerUne = async (i) => {
    const fi = pretes && ph.parIndice[i]; if (!fi) return;
    const m = await envoyer([fi], `${titre} · ${i + 1}`);
    if (m) setPh((p) => (p ? { ...p, unes: new Set(p.unes).add(i) } : p));
  };
  const nPh = photos.length;
  const libelle = ph && ph.encours ? `Photo ${Math.min(ph.total, ph.fait + ph.rate + 1)} sur ${ph.total}…`
    : pretes && peutPartagerFichiers(ph.fichiers) ? (ph.enregistre ? 'Enregistrer à nouveau' : ph.fichiers.length > 1 ? `Enregistrer les ${ph.fichiers.length} photos` : 'Enregistrer la photo')
    : pretes && ph.enregistre ? 'Télécharger à nouveau'
    : partageFichiersPossible() ? (nPh > 1 ? `Préparer les ${nPh} photos réglées` : 'Préparer la photo réglée')
    : (nPh > 1 ? `Télécharger les ${nPh} photos réglées` : 'Télécharger la photo réglée');
  return { ph, pretes, enregistrer, enregistrerUne, libelle };
}
// ══ « À LA MAIN » POUR PLUSIEURS ANNONCES D'UN COUP — LE KIT (10 nov., lot AP) ══════════
// Julien (9 nov., demande 17) : « la conseiller (moins risquée) et la rendre attirante ;
// transmettre les photos retouchées à la galerie du téléphone ; … comment gérer les descriptions
// en sélection multiple ». Une carte par paire cochée : sa photo, son N°, son titre, sa
// description TELLE QU'ELLE PARTIRA (la règle de l'atelier, `annonceRepubliee` : lettre et N°
// selon Réglages → Numéros) ; trois gestes : copier le N°, copier la description, enregistrer
// les photos réglées (`usePhotosReglees`, une à une dans « Pas à pas »). « Tout copier » : N° +
// titre + description de chacune (src/republierKit.js). « Pas à pas » ouvre la feuille en cinq
// étapes sur la même liste (prix, titre, relier). « Ouvrir Vinted » note le début du suivi de
// chaque paire numérotée : la vue Republier demande ensuite de désigner la nouvelle annonce
// (SON clic : le N° suit la paire, jamais deviné). Rien ne part chez Vinted d'ici.
// Une fiche pas lue est DITE (« pas lue »), jamais copiée vide.
function CarteKit({ x, regs, copie, copies, copier, domaine, ouverte, onOuvrir }) {
  const { p, ann, photos, lue } = x;
  const nPh = photos.length;
  const { ph, pretes, enregistrer, libelle } = usePhotosReglees(photos, regs.photo, p.numero);
  const num = numeroACopier(p.numero, ann.etiquette);
  const kN = 'num:' + x.k, kD = 'desc:' + x.k;
  const descOk = lue === true;
  const cssPh = { width: '100%', height: '100%', objectFit: 'cover', ...cssApercuPhoto(regs.photo) };
  const bouton = (k, lab, val, icone, extra) => <Bouton variante={copies.has(k) ? 'discret' : 'secondaire'} icone={copie === k ? 'check' : icone} onClick={() => copier(k, val)} {...extra}>{copie === k ? 'Copié' : lab}</Bouton>;
  return (
    <li className="vrm-kit-carte" data-kit-paire={p.id} data-kit-lue={lue === undefined ? 'encours' : lue ? '1' : '0'}>
      <div className="vrm-kit-tete">
        <span className="vrm-kit-photo">{photos[0] ? <PhotoVinted src={photos[0]} alt="" style={cssPh}/> : <PhotoVide remplir/>}{nPh > 1 ? <span className="vrm-rm-apercu-n">{nPh}</span> : null}</span>
        <div className="vrm-kit-texte">
          <div className="vrm-rm-paire-nom">{p.numero ? <Numero n={p.numero} taille="petit"/> : null}<span>{ann.titre || 'Sans titre'}</span></div>
          <div className="vrm-rm-paire-sous">{p.compte}{ann.prix != null ? <> · <b>{montant(ann.prix)}</b></> : null}</div>
          <div className="vrm-kit-desc" data-kit-desc="">{lue === undefined ? <span className="vrm-rm-muet">Lecture…</span> : descOk ? (ann.description || <span className="vrm-rm-muet">Pas de description.</span>) : <span className="vrm-rm-ambre">Description pas lue : copie-la depuis Vinted.</span>}</div>
        </div>
      </div>
      {/* (11 nov., lot DJ8 — « que tout soit parfait ») LES GESTES DANS L'ORDRE où il les fait :
          1 les photos dans sa galerie, 2 Vinted ouvert sur « Vendre », 3 le N° et la description à
          coller. « Vinted » note le suivi de CETTE paire (par son identité) : la vue Republier lui
          demandera ensuite de désigner la nouvelle annonce (SON clic, le N° la suit). */}
      <ol className="vrm-kit-gestes vrm-kit-etapes">
        <li data-kit-etape="photos">{nPh > 0 ? <Bouton variante={pretes && !ph.enregistre ? 'primaire' : 'secondaire'} icone={ph && ph.enregistre ? 'check' : 'image'} data-kit-photos={p.id} data-kit-photos-n={nPh} data-kit-photos-fait={ph && ph.enregistre ? ph.enregistre : undefined} occupe={!!(ph && ph.encours)} disabled={!!(ph && ph.encours)} onClick={enregistrer}>{libelle}</Bouton>
          : <span className="vrm-rm-muet vrm-kit-sans" data-kit-sans-photo="">Photos pas lues</span>}</li>
        {/* (11 nov., « gagner du temps ») « Vinted ↗ » COPIE AUSSI la description : un geste de moins
            par paire (il colle en arrivant sur « Vendre »). « Description » reste pour la recopier. */}
        <li data-kit-etape="vinted"><Bouton variante={ouverte ? 'discret' : 'secondaire'} icone={ouverte ? 'check' : 'link'} data-kit-ouvrir-paire={p.id} data-kit-ouvrir-copie={descOk ? '1' : '0'} href={`https://${domaine}/items/new`} target="_blank" rel="noopener noreferrer" onClick={() => { if (descOk) copier(kD, ann.description); onOuvrir(); }}>{ouverte ? (descOk ? 'Description copiée' : 'Vinted ouvert') : 'Vinted ↗'}</Bouton></li>
        <li data-kit-etape="coller" className="vrm-kit-coller">
          {num ? bouton(kN, num, num, 'copy', { 'data-kit-copier-num': p.id, 'aria-label': `Copier le ${num}` }) : <span className="vrm-rm-muet vrm-kit-sans" data-kit-sans-num="">Sans N°</span>}
          {descOk ? bouton(kD, 'Description', ann.description, 'copy', { 'data-kit-copier-desc': p.id, 'aria-label': 'Copier la description' }) : null}
        </li>
      </ol>
      {ph && !ph.encours && ph.rate ? <div className="vrm-rm-ambre vrm-kit-rate">{ph.rate} photo{ph.rate > 1 ? 's' : ''} pas lue{ph.rate > 1 ? 's' : ''} : réessaie.</div> : null}
    </li>
  );
}
function PreparerALaMain({ paires, onUneParUne, onOuvrirVinted, onClose }) {
  const liste = Array.isArray(paires) ? paires : [];
  const cle = (p) => String(p.uid || '') + ':' + String(p.id);
  const cles = liste.map(cle).join(',');
  // La fiche de chaque paire (coffre) : projection des scalaires et des photos, jamais `select=data`.
  const [fiches, setFiches] = useState({});   // cle → undefined lecture · null pas su · objet lu
  useEffect(() => {
    let vivant = true;
    for (const p of liste) {
      const k = cle(p);
      (async () => {
        try {
          if (!/^\d{1,15}$/.test(String(p.uid || '')) || !/^\d{4,15}$/.test(String(p.id || ''))) throw new Error('identité');
          const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.coffre_${p.uid}_${p.id}&select=title:data->>title,desc:data->>desc,price:data->>price,photos:data->photos`, { headers: sbAuth() });
          if (!r.ok) throw new Error('lecture');
          const j = await r.json(); if (!Array.isArray(j)) throw new Error('forme');
          if (vivant) setFiches((f) => ({ ...f, [k]: j[0] || {} }));
        } catch (_) { if (vivant) setFiches((f) => ({ ...f, [k]: null })); }
      })();
    }
    return () => { vivant = false; };
  }, [cles]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [regs] = useReglagesRepub();
  const [etq, setEtq] = useState(lireEtiquetteVinted);
  useEffect(() => { const f = () => setEtq(lireEtiquetteVinted()); const off = onCloudReady(f); window.addEventListener('vrm-num-vinted', f); return () => { if (typeof off === 'function') off(); window.removeEventListener('vrm-num-vinted', f); }; }, []);
  const [lettres] = useState(() => { const o = {}; for (const p of liste) o[cle(p)] = tirerLettre(); return o; });
  const [copie, setCopie] = useState('');
  const [copies, setCopies] = useState(() => new Set());
  const [ouvertes, setOuvertes] = useState(() => new Set());   // (11 nov., lot DJ8) Vinted ouvert pour CETTE paire
  const copier = async (k, t) => {
    try { await navigator.clipboard.writeText(String(t || '')); setCopie(k); setCopies((s) => new Set(s).add(k)); setTimeout(() => setCopie((c) => (c === k ? '' : c)), 1600); }
    catch (_) { toast('Copie impossible ici : sélectionne le texte et copie-le.'); }
  };
  const items = liste.map((p) => {
    const k = cle(p); const f = fiches[k]; const fo = f || {};
    // Une fiche LUE mais sans description : la description vient de la règle (N°, lettre) ; pas lue ⇒ dite.
    const lue = f === undefined ? undefined : f === null ? false : !!String(fo.desc || '').trim();
    const prixLu = fo.price != null && fo.price !== '' && Number(fo.price) > 0 ? Number(fo.price) : (p.prix != null && Number(p.prix) > 0 ? Number(p.prix) : null);
    const annK = annonceRepubliee({ titre: String(fo.title || p.titre || ''), description: String(fo.desc || ''), prix: prixLu, floor: p.floor, numero: p.numero }, regs, { lettre: lettres[k], etiquette: etq });
    const photos = (Array.isArray(fo.photos) && fo.photos.length ? fo.photos : (p.photo ? [p.photo] : [])).map((u) => (typeof u === 'string' ? u : (u && (u.url || u.full_size_url)) || '')).filter(Boolean).slice(0, 20);
    return { k, p, f, ann: annK, photos, lue };
  });
  const kit = items.map((x) => ({ numero: x.p.numero, etiquette: x.ann.etiquette, titre: x.ann.titre, description: x.lue === true ? x.ann.description : '', lue: x.lue }));
  const cv = couvertureKit(kit);
  const n = liste.length;
  const domaine = (liste[0] && liste[0].domain) || 'www.vinted.fr';
  return (
    <SheetShell onClose={onClose} maxWidth={640} className="vrm-rm-feuille vrm-kit-feuille" titre="Republier à la main" sousTitre={`${n} annonce${n > 1 ? 's' : ''}`} data-kit-main={n}>
      {/* Le conseil, en tête : une phrase, trois gestes. */}
      <div className="vrm-kit-conseil" data-kit-conseil="">
        <span className="vrm-kit-conseil-icone" aria-hidden="true"><Icon name="shield" size={20}/></span>
        <div><b>Le plus sûr : tu publies toi-même.</b><span>Photos, puis « Vinted ↗ » : description déjà copiée.</span></div>
      </div>
      <div className="vrm-kit-barre">
        <span className="vrm-rm-muet" data-kit-couverture={`${cv.lues}/${cv.n}`}>{cv.enCours ? 'Lecture des fiches…' : cv.lues === cv.n ? `${n} description${n > 1 ? 's' : ''} prête${n > 1 ? 's' : ''}` : `Descriptions lues : ${cv.lues} sur ${cv.n}`}</span>
        {n > 1 ? <Bouton variante={copies.has('tout') ? 'discret' : 'secondaire'} icone={copie === 'tout' ? 'check' : 'copy'} data-kit-tout-copier={n} onClick={() => copier('tout', texteKit(kit))}>{copie === 'tout' ? 'Copié' : 'Tout copier'}</Bouton> : null}
      </div>
      <ul className="vrm-kit-liste">{items.map((x) => <CarteKit key={x.k} x={x} regs={regs} copie={copie} copies={copies} copier={copier} domaine={x.p.domain || domaine} ouverte={ouvertes.has(x.k)} onOuvrir={() => { setOuvertes((o) => new Set(o).add(x.k)); if (onOuvrirVinted) onOuvrirVinted([x.p]); }}/>)}</ul>
      <p className="vrm-rm-muet" data-kit-relier="">Publiée ? Désigne la nouvelle dans Republier : le N° la suit.</p>
      <div className="vrm-rm-pied">
        <Bouton variante="secondaire" data-kit-pas-a-pas={n} onClick={onUneParUne}>Pas à pas</Bouton>
        <Bouton variante="primaire" data-kit-ouvrir-vinted="" href={`https://${domaine}/items/new`} target="_blank" rel="noopener noreferrer" onClick={() => onOuvrirVinted && onOuvrirVinted()}>Ouvrir Vinted ↗</Bouton>
      </div>
    </SheetShell>
  );
}
// ⟦← App.jsx #8⟧
function RepublierVinted({ annonces: toutes, publier, refaire = null, compteChrome, compteVinted, majExt, lettreOk, brouillonOk, onClose, onReessayer = null, action = 'recreer', reprise = null, depart = null, programme = null, programmeMode = null, progsRepub = null, onProgrammeFait = null }) {
  // (11 nov., lot republier-programme) Une programmation : SES réglages figés (src/repubProgramme.js).
  const PR = programme && programme.reglages ? programme.reglages : null;
  const A = ACTIONS_REPUB[action] || ACTIONS_REPUB.recreer;
  // (28 oct., sa demande) Seules les paires du compte Vinted OUVERT DANS CHROME
  // (cookie lu par l'extension, `vintedDeChrome`) : c'est le seul au nom duquel
  // l'extension peut agir (garde stricte). Compte pas su ou aucun ⇒ aucune paire,
  // et la phrase dit pourquoi — jamais une liste d'un autre compte.
  const compteUid = compteChrome ? String(compteChrome) : '';
  // (2 nov.) « Brouillons → en ligne » : les brouillons des AUTRES comptes restent
  // montrés, grisés, avec leur compte (« brouillon du compte X — ouvre Vinted sur ce
  // compte »), jamais cochables. Un brouillon d'un autre compte qui arriverait sans
  // raison est bloqué ici aussi : seul le compte de Chrome peut partir.
  const annonces = action === 'enLigne'
    ? toutes.map((a) => (String(a.uid || '') === compteUid || a.bloque) ? a : { ...a, bloque: `brouillon du compte ${a.compte || a.uid || 'inconnu'} — ouvre Vinted sur ce compte pour le mettre en ligne`, place: 'autre-compte' })
    : (compteUid ? toutes.filter((a) => String(a.uid || '') === compteUid) : []);
  const horsCompte = action === 'enLigne' ? 0 : toutes.length - annonces.length;
  const nomCompte = (compteVinted && compteVinted.login) || (compteUid ? `compte ${compteUid}` : '');
  const recree = action === 'recreer' || action === 'versBrouillon';   // une nouvelle annonce / un brouillon : favoris perdus
  // (5 nov.) Ouvert depuis « Actions possibles » : le choix est fait (sa sélection),
  // on commence à l'étape d'après — « Retour » ramène au choix, rien n'est perdu.
  const [etape, setEtape] = useState(() => (programme ? 'envoi' : depart && Array.isArray(reprise) && reprise.length ? depart : 'choix'));
  const [sel, setSel] = useState(() => new Set(Array.isArray(reprise) ? reprise.map(String) : []));
  const [q, setQ] = useState('');
  // (6 nov.) Les réglages (photos, prix, titre, lettre) de « Republier » et « En ligne →
  // brouillon » sont CEUX de « Republier à la main » (`useReglagesRepub`, synchronisés) :
  // la retouche photo et la lettre réglées ici valent là-bas (gardées, synchronisées).
  // (29 oct., et décision du 6 nov.) Rien ne baisse sans son clic : le PRIX et le TITRE
  // repartent de « Garder » / « Ne pas changer » à CHAQUE ouverture, jamais gardés.
  // « Modifier prix ou titre » a des réglages à lui, tous neutres à chaque ouverture.
  // Une programmation rouverte (départ ou modification) part de SES réglages figés, jamais des réglages du moment.
  const partage = (action === 'recreer' || action === 'versBrouillon') && !PR;
  const [regsP, poserRegsP] = useReglagesRepub();
  const [regsL, setRegsL] = useState(() => lireReglagesRepub(PR ? PR.regs : null));
  const regsLRef = React.useRef(regsL);
  const regs = partage ? regsP : regsL;
  const poserR = partage ? poserRegsP : (patch) => { const c = regsLRef.current; const n = lireReglagesRepub({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) }); regsLRef.current = n; setRegsL(n); };
  const tMode = regs.titre.mode, tVal = regs.titre.valeur, tChe = regs.titre.chercher;
  const setTMode = (v) => poserR((c) => ({ titre: { ...c.titre, mode: v } }));
  const setTVal = (v) => poserR((c) => ({ titre: { ...c.titre, valeur: v } }));
  const setTChe = (v) => poserR((c) => ({ titre: { ...c.titre, chercher: v } }));
  const { base: pBase, delta: pDelta, commun: pCommun, arrondi: pArr, fin: pFin } = regs.prix;
  const setPBase = (v) => poserR((c) => ({ prix: { ...c.prix, base: v } }));
  const setPDelta = (v) => poserR((c) => ({ prix: { ...c.prix, delta: v } }));
  const setPCommun = (v) => poserR((c) => ({ prix: { ...c.prix, commun: v } }));
  const setPArr = (v) => poserR((c) => ({ prix: { ...c.prix, arrondi: v } }));
  const setPFin = (v) => poserR((c) => ({ prix: { ...c.prix, fin: v } }));
  const [esp, setEsp] = useState(() => (PR && PR.esp && PR.esp.fixe !== '' && PR.esp.fixe != null && Number.isFinite(Number(PR.esp.fixe)) && Number(PR.esp.fixe) >= 0 ? Number(PR.esp.fixe) : REPUB_ESP_DEFAUT));
  // (28 oct., sa demande) Temps ALÉATOIRE entre deux paires, entre SON minimum et
  // SON maximum (en minutes) — c'est lui qui le choisit et qui lance (§3, l'atelier).
  const espMem = (() => { const v = load('vrm_republier_esp', null); return v && typeof v === 'object' ? v : {}; })();
  const espSrc = PR && PR.esp ? PR.esp : espMem;
  const [espMode, setEspMode] = useState(espSrc.mode === 'aleatoire' || espSrc.mode === 'fixe' ? espSrc.mode : 'vintex');
  const [espMin, setEspMin] = useState(Number(espSrc.min) > 0 ? Number(espSrc.min) : 1);
  const [espMax, setEspMax] = useState(Number(espSrc.max) > 0 ? Number(espSrc.max) : 3);
  // (12 nov., sa décision) Par petits groupes de 3 à 6, une pause de 15 à 45 min entre deux :
  // allumé par défaut, il voit le plan (« Pause 27 min » sur la ligne) et peut l'éteindre ou le retirer.
  const [groupes, setGroupes] = useState(espSrc.groupes !== false);
  const [pauses, setPauses] = useState({});
  const [prochaine, setProchaine] = useState(null);  // { at, s } : la prochaine paire part à `at`
  const [, setTic] = useState(0);
  const minutesOk = (v) => { const n = Number(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? Math.min(60, Math.round(n * 10) / 10) : 1; };
  const bornesAlea = () => { const a = fileClamp(minutesOk(espMin) * 60), b = fileClamp(minutesOk(espMax) * 60); return [Math.min(a, b), Math.max(a, b)]; };
  React.useEffect(() => { if (!PR) save('vrm_republier_esp', { mode: espMode, min: espMin, max: espMax, groupes }); }, [espMode, espMin, espMax, groupes]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!prochaine) return undefined; const t = setInterval(() => setTic((n) => n + 1), 1000); return () => clearInterval(t); }, [prochaine]);
  const [ok, setOk] = useState(() => !!(programme && programmeMode === 'depart'));
  const [mode, setMode] = useState('idle');          // idle | run | pause | fini
  const [st, setSt] = useState({});                  // id → { etat, raison, ancien, nouveau }
  // (28 oct., sa demande : « une barre de progression ») L'étape en cours de
  // chaque paire, annoncée par l'extension (`maj · repub`, 5.259). Rien n'en est
  // déduit : le résultat reste celui que rend l'extension à la fin.
  const [prog, setProg] = useState({});              // id → { etape, fait, total }
  useEffect(() => {
    const f = (e) => { const d = e && e.detail; if (!(d && d.type === 'maj' && d.quoi === 'repub' && d.id)) return;
      // (29 oct.) La mise en ligne planifiée est faite : son résultat remplace « prévue vers… ».
      if (d.etape === 'fin') { const fin = d.fin || {}; const id = String(d.id); setSt((p) => (p[id] && p[id].etat === 'planifiee') ? { ...p, [id]: etatDeFinRepub(fin) } : p); return; }
      setProg((p) => majProgRepub(p, d)); };
    window.addEventListener('vrm:ext', f);
    return () => window.removeEventListener('vrm:ext', f);
  }, []);
  const [tri, setTri] = useState('anciennes');       // anciennes | vues | favoris
  const [arret, setArret] = useState('');            // un refus qui vaut pour toute la file
  // (30 oct.) Vinted a dit « réessaie dans N min » : « Reprendre » attend jusque-là
  // (relancer tout de suite se ferait refuser à son tour). Le délai vient du message.
  const [arretJusqua, setArretJusqua] = useState(0);
  // (12 nov., 5.370) La discrétion de l'extension a dit « attends » (autre compte, même série,
  // ouverture de Vinted) : la MÊME paire repart à cette heure-là, rien n'est compté en échec.
  const reportRef = React.useRef(null);   // { id, at }
  React.useEffect(() => { if (!(arretJusqua > Date.now())) return undefined; const t = setInterval(() => setTic((n) => n + 1), 15000); return () => clearInterval(t); }, [arretJusqua]);
  const [ordre, setOrdre] = useState(() => (PR && Array.isArray(PR.ordre) ? PR.ordre.map(String) : null));          // null = l'ordre de sa sélection
  // (28 oct.) Réglages photo, communs à la sélection : les VALEURS de l'aperçu
  // (CSS), refaites en pixels par l'extension à partir de l'ORIGINAL.
  const reg = regs.photo;
  const setReg = (v) => poserR((c) => ({ photo: typeof v === 'function' ? v(c.photo) : v }));
  // (28 oct., sa demande) UN réglage pour toutes les photos de toutes les
  // annonces choisies ; une photo par annonce à l'écran (pas d'encombrement).
  // (28 oct., sa demande) La description part TELLE QUELLE ; en option, UNE
  // lettre au hasard tout en bas de chacune (tirée ici, montrée sur la ligne).
  const lettreOn = regs.lettre;
  const setLettreOn = (v) => poserR({ lettre: !!v });
  // (28 oct., sa demande : « ça met en brouillon puis ça publie ») Allumé par défaut
  // quand l'extension sait le faire ; il peut repasser à la création directe.
  const [viaBrouillonChoix, setViaBrouillon] = useState(() => (PR && PR.viaBrouillon === false ? false : true));
  // (29 oct., revue) Depuis la 5.277 l'extension passe TOUJOURS par un brouillon (comme Vintex) :
  // décocher la case annonçait « créée directement en ligne » et figeait la file Vinted 1 à 3 min.
  const viaBrouillon = extSait('republierpage') === 'ok' ? true : viaBrouillonChoix;
  const [lettres, setLettres] = useState(() => (PR && PR.lettres && typeof PR.lettres === 'object' ? { ...PR.lettres } : {}));
  const tirerLettres = (ids) => { const o = {}; ids.forEach((id) => { o[id] = tirerLettre(); }); setLettres(o); };
  const presets = (() => { const p = load('vrm_photo_presets', []); return Array.isArray(p) ? p.filter((x) => x && x.nom && x.r) : []; })();
  const regNeutre = photoNeutre(reg);
  const busy = React.useRef(false);
  const bas = (s) => String(s || '').toLowerCase();
  // (28 oct.) Comme les outils du marché : on republie d'abord les paires qui
  // DORMENT (les plus anciennes, les moins vues), pas celles qui plaisent.
  const triVal = (a) => tri === 'vues' ? (a.vues == null ? 1e9 : a.vues) : tri === 'favoris' ? (a.favoris == null ? 1e9 : a.favoris) : -(a.age == null ? -1 : a.age);
  const liste = annonces.filter((a) => !q.trim() || bas(a.titre).includes(bas(q.trim())) || String(a.key).includes(q.trim()) || bas(a.compte).includes(bas(q.trim())))
    .slice().sort((x, y) => (action === 'enLigne' ? (x.bloque ? 1 : 0) - (y.bloque ? 1 : 0) : 0) || triVal(x) - triVal(y));
  // Une annonce déjà recréée il y a moins de 2 jours : la recréer encore ressemble
  // à un doublon pour Vinted (les vendeurs conseillent 2-3 jours d'écart).
  const RECREE_RECENT_MS = 48 * 3600e3;
  const recente = (a) => a.recreeAt != null && Date.now() - a.recreeAt < RECREE_RECENT_MS;
  const ilYa = (t) => { const h = Math.max(1, Math.round((Date.now() - t) / 3600e3)); return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`; };
  const toggle = (id) => setSel((s) => { const u = new Set(s); u.has(id) ? u.delete(id) : u.add(id); return u; });
  // (6 nov.) L'aperçu : LA règle de src/republierReglages.js (celle de « à la main » aussi).
  const apercu = (a) => apercuRepub(a, regs);
  // L'ordre de SA sélection (un Set garde l'ordre des clics).
  const choisies = [...sel].map((id) => annonces.find((a) => a.id === id)).filter(Boolean);
  // (6 nov.) La lettre est un réglage GARDÉ (le même qu'à la main) : allumée à l'ouverture,
  // chaque annonce choisie qui n'en a pas encore en reçoit une, tirée et montrée dans l'aperçu.
  const cleChoisies = choisies.map((a) => a.id).join(',');
  React.useEffect(() => { if (!lettreOn) return; setLettres((o) => { const manque = choisies.filter((a) => !o[a.id]); if (!manque.length) return o; const n = { ...o }; manque.forEach((a) => { n[a.id] = tirerLettre(); }); return n; }); }, [lettreOn, cleChoisies]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Recréer EST le geste : une paire sans changement part aussi (nouvelle annonce, mêmes infos).
  const aFaireSel = choisies.filter((a) => { if (a.bloque) return false; if (action === 'enLigne') return true; const x = apercu(a); if (action === 'modifier' && x.prix == null && !x.titre) return false; return !x.tropLong && !x.invalide; });
  // (28 oct., sa demande) L'ORDRE DE REMISE EN LIGNE : celui de sa sélection, ou
  // mélangé, ou réglé à la main. (Par brouillon, depuis le 28 oct. nuit : enregistrée,
  // supprimée, PUIS recréée — voir `recreerVinted`.) C'est l'ordre de PASSAGE qui change, donc
  // l'ordre dans lequel les nouvelles annonces apparaissent sur Vinted.
  const aFaireCalc = ordre ? [...ordre.map((id) => aFaireSel.find((a) => a.id === id)).filter(Boolean), ...aFaireSel.filter((a) => !ordre.includes(a.id))] : aFaireSel;
  // (2 nov., capture de Julien : « En cours : l'avancée est ci-dessous. » puis RIEN)
  // CAUSE : la file était recalculée à chaque rendu depuis la liste VIVANTE (ses
  // paires en ligne, ses brouillons). Pendant la republication, l'ancienne annonce
  // est supprimée de Vinted (étape « Retrait ») et le brouillon mis en ligne sort
  // de ses brouillons : la relecture les retirait de `aFaire` — la paire EN COURS
  // disparaissait, puis toute la file : plus de barre, plus de ligne, la phrase
  // « ci-dessous » mentait. La file est FIGÉE au lancement (ordre, paires, prix) ;
  // seule une paire pas commencée qui a quitté la liste vivante (vendue, retirée)
  // est sautée, et c'est dit sur sa ligne.
  const [figee, setFigee] = useState(null);
  // (11 nov., lot suivi-travail) Le pilote de la feuille « VRM travaille » (src/suiviTravail.js).
  const suiviRef = React.useRef(null);
  const arretJusquaRef = React.useRef(0);
  arretJusquaRef.current = arretJusqua;
  const aFaire = mode !== 'idle' && figee ? figee : aFaireCalc;
  // (3 nov.) Vérifier avant de republier (`src/verifAnnonce.js`) : le titre et le
  // prix qui PARTIRONT (l'aperçu), les photos, la taille et la marque lues.
  const lotVerif = () => aFaireCalc.map((a) => { const x = action === 'enLigne' ? {} : apercu(a); return { numero: a.numero, titre: x.titre || a.titre, prix: x.prix != null ? x.prix : a.prix, achat: a.floor,
      ...(a.nPhotos != null ? { nPhotos: a.nPhotos } : {}), ...(a.taille !== undefined ? { taille: a.taille, famille: a.famille || '' } : {}), ...(a.marque !== undefined ? { marque: a.marque } : {}),
      // (11 nov., lot verif-publication) Le N° écrit (la lecture de la description qui
      // repart, la lettre du bas sautée) et « déjà en ligne sur ce compte » (une AUTRE
      // annonce, même N°), tels que l'écran Annonces les a lus ; absents ⇒ rien jugé.
      ...pickVerif(a.verif) }; });
  const verifierLot = () => verifierAvantPublication(problemesLot(lotVerif(), 'vinted'), { site: 'vinted' });
  // (11 nov., lot republier-programme) Ce que « Programmer » fige : ses réglages TELS QU'À L'ÉCRAN.
  const reglagesFiges = () => ({ regs, esp: { mode: espMode, min: espMin, max: espMax, fixe: esp }, plan, lettres, ordre: aFaireCalc.map((a) => a.id), viaBrouillon: viaBrouillonChoix });
  const absentesProg = React.useRef([]);
  const lancerFile = async () => {
    if (!(await verifierLot())) return false;
    setFigee(aFaireCalc.map((a) => ({ ...a }))); setMode('run');
    // (11 nov., Julien : « VRM reste FIGÉ avec le DÉTAIL de tout ce que VRM fait et une BARRE ») La
    // feuille « VRM travaille » suit la file : ses deux gestes reviennent ici (pause, arrêt, reprise).
    // La dernière étape n'est cochée que sur le « fait » rendu par l'extension (Vinted a accepté) — jamais supposée.
    const etapesSuivi = [...listeEtapesSuivi(), ['accepte', 'Acceptée par Vinted ✓']];
    suiviRef.current = suivi.demarrer({ sorte: `republier-${action}`, titre: A.titre, etapes: etapesSuivi, uid: compteUid,
      articles: aFaireCalc.map((a) => ({ id: a.id, num: a.numero || '', titre: a.titre || '' })),
      surGeste: (quoi) => {
        if (quoi === 'pause') setMode((m) => (m === 'run' ? 'pause' : m));
        else if (quoi === 'arret') setMode('fini');
        else if (quoi === 'reprendre') {
          const t = suiviRef.current; const reste = arretJusquaRef.current - Date.now();
          if (reste > 0) { if (t) { t.noter(`Vinted demande d’attendre : reprise possible dans ${Math.ceil(reste / 60000)} min`, null, 'pause'); t.pause({ jusqua: arretJusquaRef.current, raison: 'Vinted demande d’attendre' }); t.terminer('', 'pause'); } return; }
          setMode('run');
        }
      } });
    // (11 nov.) Un départ programmé le dit en tête du journal, et nomme les paires qui ne sont plus en ligne.
    if (programme && programmeMode === 'depart' && suiviRef.current) {
      // Le journal reste en français (trace copiable, règle du lot suivi-travail).
      const hh = new Date(programme.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      suiviRef.current.noter(`Départ programmé de ${hh} : les réglages de ta programmation`);
      const nAbs = absentesProg.current.length;
      if (nAbs) suiviRef.current.noter(`${nAbs} annonce${nAbs > 1 ? 's' : ''} programmée${nAbs > 1 ? 's' : ''} plus en ligne : pas envoyée${nAbs > 1 ? 's' : ''}`, null, 'pause');
    }
    return true;
  };
  // (11 nov., lot republier-programme) C'EST L'HEURE : le départ a été pris par CET appareil (conditions
  // vérifiées). L'atelier part avec SES réglages ; la liste vivante pas encore lue ⇒ on l'attend (90 s au
  // plus) ; aucune paire encore en ligne ⇒ rien ne part, et c'est dit (« pas partie »).
  const lanceProg = React.useRef(false);
  const departProg = !!(programme && programmeMode === 'depart');
  React.useEffect(() => {
    if (!departProg || lanceProg.current || mode !== 'idle' || !toutes.length) return;
    lanceProg.current = true;
    const { partent, absentes } = pairesAuDepart(programme, aFaireCalc);
    if (!partent.length) { noterPasPartie(programme, [{ cle: 'vide' }]); return; }
    absentesProg.current = absentes;
    lancerFile().then((parti) => { if (!parti) noterPasPartie(programme, [{ cle: 'verif' }]); });
  }, [departProg, toutes.length, cleChoisies]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!departProg) return undefined;
    const t = setTimeout(() => { if (!lanceProg.current) { lanceProg.current = true; noterPasPartie(programme, [{ cle: 'liste' }]); } }, 90000);
    return () => clearTimeout(t);
  }, [departProg]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (departProg && mode === 'fini') modifierProgrammes((d) => marquerFinie(d, programme.uid, programme.id), ctxLigne()); }, [departProg, mode]);   // eslint-disable-line react-hooks/exhaustive-deps
  // La paire suivante, dont le bloc d'avancée dit le temps : sa ligne ne le redit pas (§7).
  const idAnnoncee = mode === 'run' ? ((aFaire.find((a) => !st[a.id]) || {}).id || null) : null;
  const melanger = () => {
    const ids = aFaireSel.map((a) => a.id); if (ids.length < 2) return;
    let t; for (let k = 0; k < 8; k++) { t = ids.slice(); for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } if (t.join() !== aFaire.map((a) => a.id).join()) break; }
    setOrdre(t);
  };
  const bouger = (id, d) => { const ids = aFaire.map((a) => a.id); const i = ids.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; setOrdre(ids); };
  // (28 oct.) Les temps d'attente sont TIRÉS AVANT de lancer et montrés sur
  // chaque ligne (« +1 min 23 s ») : il voit ce qui va se passer. « Tirer
  // d'autres temps » les refait. La première paire part tout de suite.
  const tirerTemps = () => { const [a, b] = espMode === 'vintex' ? REPUB_ESP_VINTEX : bornesAlea(); return a + Math.floor(Math.random() * (b - a + 1)); };
  const [plan, setPlan] = useState(() => (PR && PR.plan && typeof PR.plan === 'object' ? { ...PR.plan } : {}));
  const clePlan = aFaire.map((a) => a.id).join(',') + '|' + espMode + '|' + espMin + '|' + espMax + '|' + esp + '|' + (groupes ? 'g' : '');
  // (11 nov., lot republier-programme) Les temps tirés d'une programmation sont CEUX qu'il a vus : gardés
  // paire par paire tant que l'espacement n'a pas changé (une paire partie entre-temps ne décale rien).
  const espFige = !!(PR && PR.esp && PR.plan && espMode === PR.esp.mode && String(espMin) === String(PR.esp.min) && String(espMax) === String(PR.esp.max) && String(esp) === String(PR.esp.fixe));
  const refaitPlan = () => { const r = planParGroupes(aFaire.map((a) => a.id), { espace: () => (espMode !== 'fixe' ? tirerTemps() : fileClamp(esp)), groupes }); const o = { ...r.plan }; if (espFige) aFaire.forEach((a, i) => { const g = Number(PR.plan[a.id]); if (i > 0 && Number.isFinite(g) && g > 0) o[a.id] = g; }); setPlan(o); setPauses(r.pauses); };
  React.useEffect(() => { if (mode === 'idle') refaitPlan(); }, [clePlan]);   // eslint-disable-line react-hooks/exhaustive-deps
  const duree = (sec) => sec >= 60 ? `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s` : `${sec} s`;
  const autresComptes = compteChrome ? aFaire.filter((a) => a.uid && String(a.uid) !== String(compteChrome)).length : 0;
  // Le moteur : une annonce à la fois, l'espacement AVANT chacune sauf la
  // première ; une pause ou un arrêt pendant l'attente n'engage rien, une
  // annonce commencée finit toujours (jamais coupée en deux).
  React.useEffect(() => {
    if (mode !== 'run' || busy.current) return;
    // Une paire PAS COMMENCÉE qui n'est plus dans la liste vivante (vendue, retirée,
    // brouillon disparu) : sautée, jamais envoyée, et dit sur sa ligne.
    // Une liste vivante VIDE (relecture en cours, lecture ratée) ne dit rien : « rien lu » ne vaut pas « rien » (§5).
    const partie = toutes.length > 0 && aFaire.find((a) => !st[a.id] && !aFaireCalc.some((x) => x.id === a.id));
    if (partie) { setSt((p) => ({ ...p, [partie.id]: { etat: 'echec', code: 'plus-dans-la-liste', raison: action === 'enLigne' ? 'pas envoyé : ce brouillon n’est plus proposable (plus sur Vinted, ou sur un autre compte)' : 'pas envoyée : elle n’est plus en ligne sur ce compte (vendue ou retirée)' } })); return; }
    const suiv = aFaire.find((a) => !st[a.id]);
    // Des mises en ligne encore planifiées (« à la suite ») : la file n'est finie qu'après elles.
    if (!suiv) { if (!aFaire.some((a) => (st[a.id] || {}).etat === 'planifiee')) setMode('fini'); return; }
    const premier = !Object.keys(st).length;
    let annule = false;
    let delai = 0;
    if (!premier) { const pv = plan[suiv.id]; delai = Number.isFinite(pv) && pv > 0 ? pv : (espMode !== 'fixe' ? tirerTemps() : fileClamp(esp)); }
    if (reportRef.current && reportRef.current.id === suiv.id) delai = Math.max(premier ? 0 : delai, Math.ceil((reportRef.current.at - Date.now()) / 1000));
    setProchaine(delai > 0 ? { at: Date.now() + delai * 1000, s: delai } : null);
    const t = setTimeout(async () => {
      if (annule) return;
      setProchaine(null);
      busy.current = true;
      setSt((p) => ({ ...p, [suiv.id]: { etat: 'encours' } }));
      const x = apercu(suiv);
      let r; try { r = await publier(suiv, { prix: x.prix != null ? x.prix : suiv.prix, titre: x.titre || suiv.titre, reglages: { ...reg }, lettre: lettreOn && lettreOk ? (lettres[suiv.id] || '') : '', viaBrouillon: viaBrouillon && !!brouillonOk, ...(programme && programmeMode === 'depart' ? { programme: true } : {}) }); } catch (_) { r = { etat: 'echec', raison: 'erreur' }; }
      busy.current = false;
      if (r && r.code === 'discretion' && Number(r.attendreMs) > 0) {
        reportRef.current = { id: suiv.id, at: Date.now() + Number(r.attendreMs) + 5000 };
        setSt((p) => { const n = { ...p }; delete n[suiv.id]; return n; });
        return;
      }
      if (reportRef.current && reportRef.current.id === suiv.id) reportRef.current = null;
      const etat = r && ['fait', 'double', 'incertain', 'a-refaire', 'planifiee'].includes(r.etat) ? r.etat : 'echec';
      setSt((p) => ({ ...p, [suiv.id]: { etat, code: (r && r.code) || '', raison: (r && r.raison) || (etat === 'echec' ? "l'extension n'a pas répondu" : ''), nouveau: r && r.nouveau, jusqua: r && r.jusqua, question: questionRepubOk(r && r.question) ? r.question : null } }));
      // (30 oct.) Plus aucune paire à tenter : l'arrêt est l'état FINAL (rien à reprendre).
      const resteApres = aFaire.some((a) => a.id !== suiv.id && !st[a.id]);
      const arreter = (raison) => { setArret(raison || ''); const m = /dans (\d+) ?min/.exec(String(raison || '')); setArretJusqua(m ? Date.now() + Number(m[1]) * 60000 : 0); setMode(resteApres ? 'pause' : 'fini'); };
      // Un refus qui vaut pour TOUTE la file (Vinted demande de ralentir, plafond
      // de l'heure atteint) : on s'arrête au lieu d'enchaîner les refus.
      // (2 nov., 5.311) Le frein après un refus de Vinted vaut pour tout le compte : la file s'arrête.
      if (r && (r.code === 'vinted-pause' || r.code === 'plafond' || r.code === 'frein-refus' || r.code === 'plafond-jour' || r.code === 'verification' || r.code === 'tout-arrete')) arreter(r.raison);
      // (28 oct.) L'extension n'a pas répondu à temps : elle travaille peut-être
      // encore sur CETTE paire. Enchaîner empilerait la suivante derrière elle et
      // laisserait croire à un échec : la file s'arrête, la ligne dit « pas su ».
      else if (r && r.code === 'sans-reponse') arreter(r.raison);
    }, delai * 1000);
    return () => { annule = true; clearTimeout(t); setProchaine(null); };
  }, [mode, st, esp, espMode, espMin, espMax, plan]);   // eslint-disable-line react-hooks/exhaustive-deps
  // (11 nov., lot suivi-travail) La feuille suit ce que l'ÉCRAN sait (st : résultat rendu par
  // l'extension ; prog : ses étapes annoncées ; prochaine : l'attente tirée avant de lancer).
  // Rien n'y est déduit : une annonce n'est « réussie » que si l'extension l'a dit.
  React.useEffect(() => {
    const t = suiviRef.current; if (!t || !t.etat()) return;
    for (const a of (figee || [])) {
      const s0 = st[a.id]; if (!s0) continue;
      const p0 = prog[String(a.id)] || {};
      if (s0.etat === 'encours') {
        t.debut(a.id);
        if (p0.etape) t.etape(a.id, p0.etape, p0.etape === 'photos' && p0.total > 0 ? `photo ${Math.min(p0.fait + 1, p0.total)} sur ${p0.total}` : '');
        if (p0.pause && p0.pause.jusqua > Date.now()) t.pause({ jusqua: p0.pause.jusqua, raison: `Pause au hasard ${PAUSE_NOM[p0.pause.quoi] || ''}`.trim() });
      } else if (s0.etat === 'planifiee') {
        t.debut(a.id);
        t.etape(a.id, 'attente', s0.jusqua ? `mise en ligne programmée vers ${new Date(s0.jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'mise en ligne programmée');
      } else {
        if (s0.etat === 'fait') t.etape(a.id, 'accepte');
        t.fin(a.id, issueSuivi(s0));
      }
    }
    if (prochaine && prochaine.at > Date.now()) t.pause({ jusqua: prochaine.at, raison: 'Pause entre deux annonces' });
    if (arretJusqua > Date.now()) t.pause({ jusqua: arretJusqua, raison: 'Vinted demande d’attendre' });
    // La boucle s'est arrêtée (pause, arrêt, fin) et plus rien n'est en route chez l'extension.
    const enRoute = Object.values(st).some((x) => x.etat === 'encours');
    if (mode !== 'run' && mode !== 'idle' && !enRoute && t.etat().statut === 'cours') t.terminer(arret || '', mode === 'pause' ? 'pause' : undefined);
  }, [st, prog, prochaine, mode, arret, arretJusqua]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nFait = Object.values(st).filter((s) => s.etat === 'fait').length;
  const nEchec = Object.values(st).filter((s) => s.etat === 'echec').length;
  const nDouble = Object.values(st).filter((s) => s.etat === 'double' || s.etat === 'incertain').length;
  const nRefaire = Object.values(st).filter((s) => s.etat === 'a-refaire').length;
  // Le compte rendu (sa demande) : écrit à chaque pas, relu après un rechargement.
  const debutRef = React.useRef(new Date().toISOString());
  React.useEffect(() => {
    poserRepubVivant(mode === 'run' || busy.current);
    if (mode === 'idle' && !Object.keys(st).length) return;
    ecrireJournalRepub({ v: 1, action, debut: debutRef.current, majAt: new Date().toISOString(), fini: mode === 'fini',
      paires: aFaire.map((a) => { const s0 = st[a.id] || {}; return { id: a.id, titre: a.titre || '', num: a.numero || '', etat: s0.etat || 'attente', raison: s0.raison ? String(s0.raison).slice(0, 160) : '', etape: s0.etat === 'encours' && prog[a.id] ? prog[a.id].etape || '' : '' }; }) });
  }, [mode, st, prog]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { poserRepubVivant(false); try { window.dispatchEvent(new CustomEvent('vrm:journal-repub')); } catch (_) {} }, []);
  // (28 oct., sa demande) Un brouillon raté se refait d'ici, sur la ligne, sur
  // SON clic : rien d'automatique, l'annonce d'origine n'est jamais retouchée.
  const refaireLigne = async (a) => {
    if (!refaire) return;
    const ok = await askConfirm({ title: 'Refaire le brouillon ?', desc: `« ${a.titre} » : un brouillon est recréé sur Vinted à partir de ce qui est enregistré dans VRM.${action === 'recreer' ? ' Il est mis en ligne seulement si Vinted a confirmé que l’ancienne annonce était retirée.' : ' Il n’est pas mis en ligne.'} Si Vinted n’avait pas répondu clairement la première fois, regarde d’abord tes brouillons Vinted : il y est peut-être déjà.`, ok: 'Refaire le brouillon' });
    if (!ok) return;
    setSt((p) => ({ ...p, [a.id]: { ...(p[a.id] || {}), etat: 'encours' } }));
    let r; try { r = await refaire(a); } catch (_) { r = { etat: 'echec', raison: 'erreur' }; }
    const e = r && ['fait', 'incertain', 'a-refaire'].includes(r.etat) ? r.etat : 'echec';
    setSt((p) => ({ ...p, [a.id]: { etat: e === 'echec' ? 'a-refaire' : e, raison: (r && r.raison) || (e === 'fait' ? '' : "l'extension n'a pas répondu"), refait: e === 'fait' } }));
  };
  // (2 nov., 5.310) Il manquait un champ que VRM n'a pas trouvé sur l'annonce :
  // SA réponse (une valeur de Vinted) repart pour CETTE paire seulement, une fois.
  // La file ne s'est pas arrêtée pour l'attendre (rien ne bloque les autres paires).
  const repondreLigne = async (a) => {
    const s0 = st[a.id] || {};
    const v = await demanderQuestionRepub(s0.question, a.titre || '');
    if (v == null) return;
    const reponses = { ...(s0.reponses || {}), [s0.question.champ]: v };
    setSt((p) => ({ ...p, [a.id]: { etat: 'encours' } }));
    const x = apercu(a);
    let r; try { r = await publier(a, { prix: x.prix != null ? x.prix : a.prix, titre: x.titre || a.titre, reglages: { ...reg }, lettre: lettreOn && lettreOk ? (lettres[a.id] || '') : '', viaBrouillon: viaBrouillon && !!brouillonOk, reponses, ...(programme && programmeMode === 'depart' ? { programme: true } : {}) }); } catch (_) { r = { etat: 'echec', raison: 'erreur' }; }
    const etat = r && ['fait', 'double', 'incertain', 'a-refaire', 'planifiee'].includes(r.etat) ? r.etat : 'echec';
    const q2 = questionRepubOk(r && r.question) && !(r.question.champ in reponses) ? r.question : null;
    setSt((p) => ({ ...p, [a.id]: { etat, code: (r && r.code) || '', raison: (r && r.raison) || (etat === 'echec' ? "l'extension n'a pas répondu" : ''), nouveau: r && r.nouveau, jusqua: r && r.jusqua, question: q2, reponses } }));
  };
  const cssReg = cssApercuPhoto(reg);   // (6 nov.) la même chaîne que « à la main » et l'extension
  const curseur = (lab, cle, min, max, pas) => (
    <label key={cle} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minHeight: 44 }}>
      <span style={{ width: 92, flexShrink: 0, color: C.muted }}>{lab}</span>
      <input type="range" min={min} max={max} step={pas} value={reg[cle]} data-republier-reglage={cle} onChange={(ev) => setReg((r) => ({ ...r, [cle]: Number(ev.target.value) }))} style={{ flex: 1, accentColor: C.accent }} />
      <span style={{ width: 46, textAlign: 'right', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{cle === 'rot' ? `${reg.rot}°` : `${Math.round(reg[cle] * 100)}\u00a0%`}</span>
    </label>
  );
  const fermer = () => { if (mode === 'run') return; onClose(); };
  const champ = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '9px 10px', fontSize: 15, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 44 };
  const maj = { display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 5 };
  const summ = { display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.text };
  const pageOk = extSait('republierpage') === 'ok';
  // (11 nov., lot suivi-travail) Les étapes d'UNE annonce, celles que l'extension annonce pour ce geste.
  function listeEtapesSuivi() { return action === 'versBrouillon' ? ETAPES_REPUB.versBrouillon : action === 'enLigne' ? ETAPES_REPUB.publier : action === 'modifier' ? ETAPES_MODIF : ((viaBrouillon && !!brouillonOk) ? ETAPES_REPUB.brouillon : ETAPES_REPUB.direct); }
  const ETAPES = A.etapes;
  const iEtape = Math.max(0, ETAPES.findIndex((x) => x[0] === etape));
  const s2 = (n, mot, pl) => `${n} ${n > 1 ? (pl || mot + 's') : mot}`;
  const blocAvancement = etape === 'envoi' && mode !== 'idle' && aFaire.length > 0 ? (() => {
              const finies = aFaire.filter((a) => { const e = (st[a.id] || {}).etat; return e && e !== 'encours' && e !== 'planifiee'; }).length;
              const enCours = aFaire.find((a) => (st[a.id] || {}).etat === 'encours');
              const nPlanif = aFaire.filter((a) => (st[a.id] || {}).etat === 'planifiee').length;
              const pasCommencees = aFaire.filter((a) => !st[a.id]).length;
              // (2 nov.) L'étape de la paire en cours, pour CHAQUE geste (mettre un brouillon
              // en ligne et modifier sur place aussi, plus seulement recréer).
              const lstEnCours = action === 'versBrouillon' ? ETAPES_REPUB.versBrouillon : action === 'enLigne' ? ETAPES_REPUB.publier : action === 'modifier' ? ETAPES_MODIF : ((viaBrouillon && !!brouillonOk) ? ETAPES_REPUB.brouillon : ETAPES_REPUB.direct);
              const peEnCours = enCours ? progressionRepub(prog[String(enCours.id)], action, viaBrouillon && !!brouillonOk, lstEnCours) : null;
              // La suivante : son temps d'attente (tiré avant de lancer), dit pendant que celle-ci tourne.
              const suivante = enCours ? aFaire.find((a) => !st[a.id]) : null;
              const tSuiv = suivante && Number.isFinite(plan[suivante.id]) ? plan[suivante.id] : null;
              // (30 oct., « la barre est incompréhensible ») La barre mesure ce qui est
              // RÉUSSI : jamais pleine quand 3 paires sur 4 ont raté. Ce qui demande un
              // regard (pas faite, à vérifier) se lit en ambre à la suite.
              const nPasFaites = nEchec + nRefaire;
              const total = aFaire.length;
              const part = Math.min(1, (nFait + (peEnCours ? peEnCours.part : 0)) / total);
              const partRate = Math.min(1 - part, (nPasFaites + nDouble) / total);
              const prochN = Math.min(total, total - pasCommencees + 1);
              const pl = (n, s1, s2x) => `${n} ${n > 1 ? (s2x || s1 + 's') : s1}`;
              const motF = (n) => (n > 1 ? A.faits.replace(/^(\S+)/, '$1s') : A.faits);
              const bilan = `${nFait} sur ${total} ${motF(nFait)}`;
              const titre = mode === 'fini' ? (arret ? 'Arrêté' : (nPasFaites || nDouble) ? 'Fini' : 'Terminé') : mode === 'pause' ? (arret ? 'Arrêté' : 'En pause') : enCours ? `${motsVendeur().Nom} ${aFaire.indexOf(enCours) + 1} sur ${total}` : `${motsVendeur().Nom} ${prochN} sur ${total}`;
              const r = mode === 'run' && prochaine ? Math.max(0, Math.round((prochaine.at - Date.now()) / 1000)) : null;
              const phrase = mode === 'run'
                ? (enCours ? <><b data-republier-en-cours={enCours.id} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enCours.numero ? `N°${enCours.numero} · ` : ''}{enCours.titre || 'sans titre'}</b>{suivante && tSuiv != null ? <span data-republier-suivante={tSuiv} style={{ display: 'block', color: C.muted, fontSize: 13 }}>{tSuiv > 0 ? `Puis la suivante, ${duree(tSuiv)} après celle-ci.` : 'Puis la suivante, tout de suite après.'}</span> : null}</> : r != null ? <span data-republier-prochaine={prochaine.s}>Prochain article dans {r >= 60 ? `${Math.floor(r / 60)} min ${String(r % 60).padStart(2, '0')} s` : `${r} s`}</span> : 'Préparation de la suite…')
                : arret ? <span data-republier-arret>{String(arret).replace(/[.\s]+$/, '')}. Rien d'autre n'est parti.</span>
                : mode === 'pause' ? 'Rien ne part tant que tu ne reprends pas.'
                : (!(nPasFaites || nDouble) ? 'Tout est fait.' : null);
              // Deux mots seulement : « pas faite » (rien n'a changé sur Vinted) et
              // « à vérifier » (la nouvelle annonce est en ligne, l'ancienne est restée).
              const erreur = (nPasFaites || nDouble) ? <>{[nPasFaites ? `${pl(nPasFaites, 'pas faite', 'pas faites')}${nRefaire ? ` (dont ${pl(nRefaire, 'brouillon à refaire', 'brouillons à refaire')} : bouton sur sa ligne)` : ''} : rien n'a changé sur Vinted${onReessayer && nEchec ? ' — « Réessayer » en bas' : ''}` : null, nDouble ? `${pl(nDouble, 'à vérifier', 'à vérifier')} : ouvre l'ancienne annonce sur Vinted (lien sur sa ligne)` : null].filter(Boolean).join(' · ')}.</> : null;
              const compte = [bilan, enCours ? '1 en cours' : null, nPasFaites ? pl(nPasFaites, 'pas faite', 'pas faites') : null, nDouble ? pl(nDouble, 'à vérifier', 'à vérifier') : null, nPlanif ? pl(nPlanif, 'prévue') : null, pasCommencees ? pl(pasCommencees, 'restante') : null].filter(Boolean).join(' · ');
              return <Avancement titre={titre} phrase={phrase} part={part} partRate={partRate} label={`${nFait} sur ${total} ${motF(nFait)}`} erreur={erreur}
                data={{ 'data-republier-total': `${finies}/${total}`, 'data-republier-reussies': `${nFait}/${total}`, 'data-republier-bilan': '' }}
                compte={<span>{compte}</span>}>
                {peEnCours && <div data-republier-progression={enCours.id} data-republier-etape={peEnCours.etape || 'attente'}>
                  <BarreGeste p={prog[String(enCours.id)]} liste={lstEnCours} label={`${motsVendeur().Nom} ${aFaire.indexOf(enCours) + 1}`} barre={false} />
                </div>}
              </Avancement>;
  })() : null;
  return (
    <VoileAtelier onClick={fermer}>
      <FermeAuRetour fermer={fermer} />
      <div onClick={(ev) => ev.stopPropagation()} data-republier data-republier-action={action} data-republier-etape={etape} data-republier-mode={mode} style={{ background: C.bg, width: '100%', maxWidth: 640, maxHeight: '94dvh', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{A.titre}</div>
            {/* (30 oct.) Où j'en suis, en un coup d'œil : l'étape en cours pleine,
                les étapes faites cochées, la suivante en attente. */}
            <ol aria-label={`Étape ${iEtape + 1} sur ${ETAPES.length}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px', margin: '6px 0 0', padding: 0, listStyle: 'none', fontSize: 13 }}>
              {ETAPES.map(([k, l], i) => { const cur = i === iEtape, fait = i < iEtape; return (
                <li key={k} aria-current={cur ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 5, color: cur ? C.text : C.muted, fontWeight: cur ? 700 : 500 }}>
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: cur ? 'var(--vrm-accent)' : fait ? 'var(--vrm-b-teinte-f)' : 'transparent', border: cur || fait ? 'none' : `1px solid ${C.border}`, color: cur ? 'var(--vrm-on-accent)' : C.text }}>{fait ? '✓' : i + 1}</span>
                  {l.replace(/^\d+\.\s*/, '')}
                  {i < ETAPES.length - 1 && <span aria-hidden="true" style={{ color: C.muted, opacity: .6, marginLeft: 2 }}>›</span>}
                </li>
              ); })}
            </ol>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" disabled={mode === 'run'} title={mode === 'run' ? 'Mets en pause pour fermer' : undefined} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.muted, cursor: mode === 'run' ? 'default' : 'pointer', minWidth: 44, minHeight: 44 }}>×</button>
        </div>
        {/* (2 nov.) L'avancée HORS de la zone qui défile : la paire en cours, son étape,
            la barre, « N sur M » et le temps avant la suivante se voient toujours,
            sans défiler, quelle que soit la longueur de la liste en dessous. */}
        {blocAvancement && <div data-republier-avancee style={{ flexShrink: 0, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.bg, maxHeight: '45dvh', overflowY: 'auto' }}>{blocAvancement}</div>}
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
          {etape === 'choix' && <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Chercher un titre, un N°" aria-label="Chercher un article" style={{ ...champ, flex: 1, minWidth: 0 }} />
              {/* (30 oct.) « Tout » et « Aucune » faisaient deux boutons pour un geste : un seul, qui bascule. */}
              {(() => { const dispo = liste.filter((a) => !a.bloque); const tous = dispo.length > 0 && dispo.every((a) => sel.has(a.id));
                return tous
                  ? <Bouton data-republier-rien onClick={() => setSel(new Set())} style={{ minHeight: 44 }}>Tout décocher</Bouton>
                  : <Bouton data-republier-tout disabled={!dispo.length} onClick={() => setSel(new Set(dispo.map((a) => a.id)))} style={{ minHeight: 44 }}>Tout cocher</Bouton>; })()}
            </div>
            {action !== 'enLigne' && <select data-republier-tri value={tri} onChange={(ev) => setTri(ev.target.value)} aria-label="Ordre de la liste" style={champ}>
              <option value="anciennes">Les plus anciennes d'abord</option>
              <option value="vues">Les moins vues d'abord</option>
              <option value="favoris">Les moins de favoris d'abord</option>
            </select>}
            <div data-republier-compte={compteUid || (compteVinted === null ? 'aucun' : 'passu')} style={{ fontSize: 13, color: compteUid ? C.muted : C.warn, lineHeight: 1.45 }}>
              {compteUid
                ? <>Compte <b style={{ color: C.text }}>{nomCompte}</b> (ouvert {NAV.dansNu}){horsCompte > 0 ? <> · {horsCompte} {action === 'enLigne' ? 'autre' + (horsCompte > 1 ? 's' : '') : 'article' + (horsCompte > 1 ? 's' : '')} sur tes autres comptes <Pourquoi label="Et mes autres comptes ?">Ouvre vinted.fr sur l'un d'eux {NAV.dansNu} pour {horsCompte > 1 ? 'les' : 'la'} voir ici : seul le compte ouvert {NAV.dansNu} peut être republié.</Pourquoi></> : null}</>
                : compteVinted === null
                  ? `Aucun compte Vinted ouvert ${NAV.dansNu} : ouvre vinted.fr sur le bon compte, puis rouvre.`
                  : <>Compte ouvert {NAV.dansNu} pas encore connu : ouvre vinted.fr sur le bon compte, puis rouvre. <Pourquoi label="Pourquoi ?">L'extension VRM n'a pas encore été interrogée, ou elle ne répond pas.</Pourquoi></>}
            </div>
            {compteUid ? <JaugeActions uid={compteUid} /> : null}
            <div style={{ fontSize: 13, color: C.muted }}>{action === 'enLigne' ? `${s2(annonces.length, 'brouillon')} sur Vinted` : `${s2(annonces.length, 'article')} en ligne sur Vinted`} · <b style={{ color: C.text }}>{sel.size} choisi{action === 'enLigne' ? '' : 'e'}{sel.size > 1 ? 's' : ''}</b></div>
            {action === 'modifier' && <div style={{ fontSize: 13, color: C.muted }}>Modifiées sur place : même annonce, favoris et vues gardés.</div>}
            {action === 'versBrouillon' && <div style={{ fontSize: 13, color: C.muted }}>Chaque annonce repasse en brouillon : favoris et vues ne suivent pas. <Pourquoi label="Comment ça marche">Chaque annonce est d'abord enregistrée dans VRM (photos, description, recette), puis retirée de la vente, puis recréée en brouillon sur Vinted. Si Vinted refuse de la retirer, rien d'autre n'est fait.</Pourquoi></div>}
            <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {liste.length === 0 && <div style={{ padding: 14, fontSize: 13, color: C.muted }}>{annonces.length ? 'Aucune ne correspond.' : !compteUid ? `Le compte ouvert ${NAV.dansNu} n’est pas encore connu.` : action === 'enLigne' ? "Aucun brouillon sur ce compte d'après tes dressings lus par VRM." : "Aucun article en ligne sur ce compte n'a été lu pour l'instant."}</div>}
              {liste.map((a) => (
                <label key={a.id} data-republier-paire={a.id} data-republier-bloque={a.bloque ? 'oui' : undefined} data-republier-place={a.place || undefined} data-republier-compte-paire={action === 'enLigne' ? (a.uid || '') : undefined} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', minHeight: 56, borderBottom: `1px solid ${C.border}`, cursor: a.bloque ? 'default' : 'pointer', background: sel.has(a.id) ? 'var(--vrm-b-teinte)' : 'transparent', opacity: a.bloque ? 0.6 : 1 }}>
                  <input type="checkbox" disabled={!!a.bloque} checked={sel.has(a.id) && !a.bloque} onChange={() => toggle(a.id)} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
                  <span style={{ width: 40, height: 50, borderRadius: 6, background: C.border, overflow: 'hidden', flexShrink: 0 }}>{a.photo ? <PhotoVinted src={a.photo} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.numero ? <b>N°{a.numero} · </b> : null}{a.titre || '—'}</span>
                    {/* Le compte n'est plus redit sur chaque ligne : ce sont toutes celles du compte ouvert dans Chrome (§7). */}
                    <span style={{ display: 'block', fontSize: 12, color: C.muted }}>{action === 'enLigne' ? <>compte <b style={{ color: C.text, fontWeight: 600 }}>{a.compte || a.uid || 'inconnu'}</b> · </> : null}{prixCourt(a.prix)}{a.age != null ? ` · en ligne depuis ${a.age} j` : ''}{a.vues != null ? ` · ${s2(a.vues, 'vue')}` : ''}{a.favoris != null ? ` · ${s2(a.favoris, 'favori')}` : ''}</span>
                    {recree && recente(a) && <span data-republier-recente={a.id} style={{ display: 'block', fontSize: 12, color: C.warn }}>déjà recréée il y a {ilYa(a.recreeAt)} — attends 2 jours</span>}
                    {a.histo ? <LigneHistoriqueRepub r={a.histo} id={a.id} /> : null}
                    {a.note && <span data-republier-note={a.id} style={{ display: 'block', fontSize: 12, color: C.muted }}>{a.note}</span>}
                    {a.bloque && <span data-republier-bloque-raison={a.id} style={{ display: 'block', fontSize: 12, color: C.muted }}>{a.bloque}</span>}
                  </span>
                </label>
              ))}
            </div>
          </>}
          {etape === 'modif' && <>
            {/* (6 nov.) UNE source de réglages pour l'atelier et « Republier à la main » : dit
                une fois, avec ce qui est gardé (une baisse gardée se voit avant tout geste). */}
            {partage && (() => { const neutre = regNeutre && !regs.lettre; return (
              <div className="vrm-repub-memes" data-republier-memes-reglages={neutre ? 'neutre' : resumeGardes(regs).join(' · ')}>
                <span><b>Mêmes réglages que « Republier à la main »</b>.{neutre ? '' : <> Gardés : {resumeGardes(regs).join(' · ')}.</>} <Pourquoi>La retouche des photos et la lettre valent aussi là-bas, sur tous tes appareils ; le prix et le titre repartent de « Garder » à chaque ouverture.</Pourquoi></span>
                {!neutre && <Bouton variante="discret" data-republier-reglages-zero onClick={() => poserR({ photo: { ...PHOTO_NEUTRE }, lettre: false })}>Tout remettre à zéro</Bouton>}
              </div>); })()}
            {recree && <div data-republier-photos data-republier-photos-css={cssReg.transform + ' ' + cssReg.filter} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={maj}>Photos</span>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {choisies.map((a) => { const n = (a.photos && a.photos.length) || (a.photo ? 1 : 0); return (
                  <div key={a.id} data-republier-photos-annonce={a.id} data-republier-photos-n={n} style={{ width: 72, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span data-republier-photo-case={a.id} style={{ width: 72, height: 90, borderRadius: 12, overflow: 'hidden', background: C.border }}>{a.photo ? <PhotoVinted src={a.photo} alt="" data-republier-photo-apercu={a.id} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', ...cssReg }} /> : null}</span>
                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.numero ? `N°${a.numero}` : a.titre}{n > 1 ? ` · ${n} photos` : ''}</span>
                  </div>
                ); })}
              </div>
              {/* (30 oct.) Cinq curseurs toujours dépliés pour un réglage rare : repliés. */}
              <details className="vrm-repli" data-republier-retouche={regNeutre ? 'non' : 'oui'}>
                <summary style={summ}>{regNeutre ? 'Photos telles quelles · retoucher' : 'Photos retouchées · modifier'}</summary>
                {CURSEURS_PHOTO.map((c) => curseur(c.l, c.cle, c.min, c.max, c.pas))}
                {(presets.length > 0 || !regNeutre) && <div className="vrm-b-rangee" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
                  {presets.map((p) => <Bouton key={p.nom} className="vrm-b-petit" data-republier-preset={p.nom} onClick={() => setReg({ ...REPUB_REG_DEF, ...p.r })}>{p.nom}</Bouton>)}
                  {!regNeutre && <Bouton variante="discret" data-republier-reglage-zero onClick={() => setReg({ ...REPUB_REG_DEF })}>Photos d'origine</Bouton>}
                </div>}
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Vaut pour toutes les photos de chaque annonce choisie.</div>
              </details>
            </div>}
            {recree && <div data-republier-description={lettreOn ? 'lettre' : 'telle'} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={maj}>Description — reprise mot pour mot</span>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: lettreOk ? C.text : C.muted, minHeight: 44, cursor: lettreOk ? 'pointer' : 'default' }}>
                <input type="checkbox" data-republier-lettre disabled={!lettreOk} checked={lettreOn && lettreOk} onChange={(ev) => { setLettreOn(ev.target.checked); if (ev.target.checked) tirerLettres(choisies.map((a) => a.id)); }} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
                <span>Ajouter une lettre au hasard en bas de chaque description</span>
              </label>
              {!lettreOk && <div data-republier-lettre-maj style={{ fontSize: 12, color: C.muted }}>Demande l'extension VRM {EXT_CAPACITES.lettre} ou plus récente dans ce navigateur.</div>}
              {lettreOn && lettreOk && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.muted }}>
                <span style={{ flex: '1 1 200px' }}>Une lettre différente par annonce, visible dans l'aperçu.</span>
                <Bouton variante="discret" data-republier-lettres-retirer onClick={() => tirerLettres(choisies.map((a) => a.id))}>Tirer d'autres lettres</Bouton>
              </div>}
            </div>}
            {action === 'recreer' && <div data-republier-brouillon={viaBrouillon && brouillonOk ? 'oui' : 'non'} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={maj}>Publication</span>
              {/* (30 oct.) Avec la 5.277, le passage par un brouillon est imposé : une case
                  cochée et grisée ne servait à rien. Elle ne reste que là où on peut choisir. */}
              {brouillonOk && !pageOk && <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: C.text, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" data-republier-via-brouillon checked={viaBrouillon && !!brouillonOk} onChange={(ev) => setViaBrouillon(ev.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
                <span>Passer par un brouillon Vinted, puis le mettre en ligne</span>
              </label>}
              <div style={{ fontSize: 13, color: pageOk ? C.text : C.muted, lineHeight: 1.45 }}>{brouillonOk
                ? (viaBrouillon
                  ? (pageOk
                    ? <>Brouillon d'abord, puis en ligne 1 à 3 min après. Garde un onglet vinted.fr ouvert. <Pourquoi label="Comment ça marche">Comme Vintex : tout passe par l’onglet vinted.fr ouvert {NAV.dans}, connecté sur le bon compte. Chaque annonce est enregistrée dans VRM, rangée en brouillon sur Vinted, PUIS l’ancienne est supprimée, et le brouillon est mis en ligne 1 à 3 min plus tard.{extSait('republierfile') === 'ok' ? ' Pendant cette attente l’article suivant est déjà préparé (l’extension met chaque brouillon en ligne à son heure, même si tu fermes cette fenêtre).' : ''} Aucun essai en rafale : un refus s’arrête et le dit. Au plus 10 {motsVendeur().noms} par jour et par compte. Si Vinted ne répond pas clairement, VRM s’arrête (jamais deux fois en ligne) ; rien n’est perdu, tout est enregistré dans VRM.</Pourquoi></>
                    : <>Mets l’extension VRM à jour en {EXT_CAPACITES.republierpage} : elle passera par l’onglet vinted.fr. <Pourquoi label="Pourquoi ?">L’extension installée ici fait encore l’ancienne republication, depuis son fond, avec des renvois automatiques.</Pourquoi></>)
                  : 'L’annonce est créée directement en ligne.')
                : `Demande l'extension VRM ${EXT_CAPACITES.republierbrouillon} ou plus récente dans ce navigateur.`}</div>
            </div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={maj}>Prix</span>
              {/* (29 oct., « les réductions je ne comprends rien du tout ») Un geste
                  par bouton : garder le prix, ou baisser de 5, 10, 15, 20 %. Le reste
                  (autre %, en €, même prix pour toutes) est replié dans « Autre ». */}
              <div data-republier-reductions className="vrm-filtres" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['aucun', 'Garder le prix'], ...REDUCTIONS_RAPIDES.map((v) => [v, `−${v.slice(1)}\u00a0%`]), ['autre', 'Autre…']].map(([v, l]) => {
                  const actif = v === 'aucun' ? pBase === 'aucun' : v === 'autre' ? (pBase === 'fixe' || pBase === 'commun' || (pBase === 'pct' && !REDUCTIONS_RAPIDES.includes(String(pDelta).trim()))) : (pBase === 'pct' && String(pDelta).trim() === v);
                  return <button key={v} type="button" data-republier-reduc={v} aria-pressed={actif} onClick={() => { if (v === 'aucun') setPBase('aucun'); else if (v === 'autre') { if (pBase === 'aucun' || REDUCTIONS_RAPIDES.includes(String(pDelta).trim())) { setPBase('pct'); setPDelta(''); } } else { setPBase('pct'); setPDelta(v); } }} style={{ minHeight: 44, padding: '0 14px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>;
                })}
              </div>
              {pBase !== 'aucun' && !(pBase === 'pct' && REDUCTIONS_RAPIDES.includes(String(pDelta).trim())) && <div data-republier-autre style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select data-republier-prix value={pBase} onChange={(ev) => setPBase(ev.target.value)} aria-label="Type de baisse" style={{ ...champ, flex: '1 1 200px' }}>
                  <option value="pct">Baisser d'un pourcentage</option>
                  <option value="fixe">Baisser d'un montant en&nbsp;€</option>
                  <option value="commun">Mettre toutes au même prix</option>
                </select>
                {(pBase === 'pct' || pBase === 'fixe') && <input data-republier-delta value={String(pDelta).replace(/^-/, '')} onChange={(ev) => { const v = ev.target.value.replace(/[^0-9.,]/g, ''); setPDelta(v ? '-' + v : ''); }} inputMode="decimal" placeholder={pBase === 'pct' ? 'ex. 12 (= −12\u00a0%)' : 'ex. 5 (= −5\u00a0€)'} style={{ ...champ, maxWidth: 200 }} />}
                {pBase === 'commun' && <input data-republier-commun value={pCommun} onChange={(ev) => setPCommun(ev.target.value)} inputMode="decimal" placeholder="Prix (€)" style={{ ...champ, maxWidth: 200 }} />}
              </div>}
              {pBase !== 'aucun' && <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: C.text, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" data-republier-arrondi checked={pArr === 'euro'} onChange={(ev) => { setPArr(ev.target.checked ? 'euro' : 'aucun'); setPFin('aucune'); }} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
                <span>Arrondir à l'euro (ex. 44,10&nbsp;€ → 44&nbsp;€)</span>
              </label>}
              {(() => { const a = choisies[0]; if (!a || a.prix == null) return null; const x = apercu(a);
                return <div data-republier-exemple style={{ fontSize: 13, color: pBase === 'aucun' ? C.muted : C.text }}>{pBase === 'aucun' ? 'Les prix ne changent pas.' : <>Exemple : {a.numero ? `N°${a.numero}` : 'la première'} passe de {prixCourt(a.prix)} à <b>{prixCourt(x.prix != null ? x.prix : a.prix)}</b>{x.plancher ? ' (ramené au prix d’achat)' : ''} · jamais sous le prix d'achat.</>}</div>; })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={maj}>Titre</span>
              <select data-republier-titre value={tMode} onChange={(ev) => setTMode(ev.target.value)} aria-label="Changer le titre" style={champ}>
                {MODES_TITRE.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              {(tMode === 'remplacer' || tMode === 'supprimer') && <input value={tChe} onChange={(ev) => setTChe(ev.target.value)} placeholder="Texte à trouver" style={champ} />}
              {(tMode === 'prefixe' || tMode === 'suffixe' || tMode === 'remplacer') && <input value={tVal} onChange={(ev) => setTVal(ev.target.value)} placeholder={tMode === 'remplacer' ? 'Par' : 'Texte à ajouter'} style={champ} />}
            </div>
            <span style={maj}>Aperçu ({choisies.length})</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginTop: -5 }}>
              {choisies.map((a) => { const x = apercu(a); const rien = !x.titre && !x.prix; return (
                <div key={a.id} data-republier-apercu={a.id} data-republier-nouveau-prix={x.prix != null ? Math.round(x.prix * 100) : ''} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.numero ? <b>N°{a.numero} · </b> : null}{a.titre}</div>
                  {x.prix != null && <div style={{ color: C.muted }}>{prixCourt(a.prix)} → <b style={{ color: C.text }}>{prixCourt(x.prix)}</b>{x.plancher && <span style={{ color: C.warn }}> · ramené au prix d'achat</span>}</div>}
                  {x.titre && <div style={{ color: x.tropLong ? C.warn : C.muted }}>→ {x.titre}{x.tropLong && ` · ${x.titre.length}/${TITRE_VINTED_MAX}, trop long : elle ne partira pas`}</div>}
                  {lettreOn && lettreOk && lettres[a.id] && <div data-republier-lettre-de={a.id} style={{ color: C.muted }}>description + « {lettres[a.id]} » tout en bas</div>}
                  {rien && !(lettreOn && lettreOk) && <div style={{ color: C.muted }}>{action === 'modifier' ? 'rien à changer — elle ne partira pas' : action === 'versBrouillon' ? 'mêmes titre et prix — copiée telle quelle en brouillon' : 'mêmes titre et prix — recréée telle quelle'}</div>}
                </div>
              ); })}
            </div>
          </>}
          {etape === 'envoi' && <>
            {programme && programmeMode === 'modifier' && mode === 'idle' ? <div data-rp-modif={programme.id} style={{ fontSize: 13, color: C.text }}>{tr('rp.modif.titre', { quand: `${dateLoc(programme.at, { weekday: 'long', day: 'numeric', month: 'long' })} · ${heureLoc(programme.at)}` })}</div> : null}
            {/* (28 oct.) Après un passage, les anciennes annonces sont supprimées de Vinted :
                elles sortent de la liste et la phrase disait « 0 annonce à supprimer ». */}
            {!aFaire.length && <div data-republier-vide style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{mode === 'idle' ? "Aucune des annonces choisies n'est encore en ligne (déjà republiées ou retirées) : reviens à « Choisir »." : 'Aucun article dans cette file.'}</div>}
            {/* (30 oct.) Avant de lancer : UNE phrase par fait, le détail derrière ⓘ. */}
            {action === 'recreer' && !!aFaire.length && mode === 'idle' && <div data-republier-explique style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}><b>{s2(aFaire.length, 'annonce')}</b> à recréer sur Vinted, une par une. Le N° VRM passe sur la nouvelle. <Pourquoi label="Comment ça marche">Pour chacune : ses photos sont renvoyées{regNeutre ? '' : ' avec tes réglages'}, {viaBrouillon && brouillonOk ? "l'annonce est enregistrée dans VRM, retirée de Vinted, recréée en brouillon, puis mise en ligne. Si la mise en ligne échoue, le brouillon reste dans tes brouillons Vinted et rien n'est perdu." : 'la nouvelle annonce est créée, et seulement si elle est bien en ligne l’ancienne est supprimée.'}</Pourquoi></div>}
            {/* (11 nov., lot photos-comptes) AVANT de republier : une de ces photos déjà EN LIGNE sur un AUTRE
                compte Vinted ⇒ l'encart ambre (miniature, compte). Republier reste possible (son choix). */}
            {action !== 'enLigne' && !!aFaire.length && mode === 'idle' && <EncartPhotosAutresComptes sources={aFaire.map((a) => ({ id: a.id, compte: String(a.uid || compteUid) }))} compteCible={compteUid ? `vinted:${compteUid}` : null} PhotoVinted={PhotoVinted}/>}
            {action === 'modifier' && !!aFaire.length && mode === 'idle' && <div data-republier-explique style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}><b>{s2(aFaire.length, 'annonce')}</b> à modifier sur place, une par une : même annonce, favoris et vues gardés.</div>}
            {action === 'versBrouillon' && !!aFaire.length && mode === 'idle' && <div data-republier-explique style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}><b>{s2(aFaire.length, 'annonce')}</b> à repasser en brouillon, une par une. <Pourquoi label="Comment ça marche">Pour chacune : elle est enregistrée dans VRM, ses photos sont renvoyées{regNeutre ? '' : ' avec tes réglages'}, l'annonce en ligne est retirée, puis le brouillon est créé sur Vinted. Un brouillon n'est jamais en ligne : rien ne peut se vendre deux fois. Tu la remettras en ligne depuis « Actions → Brouillons → en ligne ».</Pourquoi></div>}
            {action === 'enLigne' && !!aFaire.length && mode === 'idle' && <div data-republier-explique style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}><b>{s2(aFaire.length, 'brouillon')}</b> à mettre en ligne, un par un, tels que tu les as enregistrés.</div>}
            {recree && (() => { const fav = aFaire.reduce((n, a) => n + (a.favoris || 0), 0); const nFav = aFaire.filter((a) => a.favoris > 0).length; const nRec = aFaire.filter(recente).length; return mode === 'idle' && <>
              {fav > 0 && <div data-republier-favoris={fav} style={{ fontSize: 13, color: C.warn }}>{s2(fav, 'favori')} {fav > 1 ? 'seront perdus' : 'sera perdu'} ({s2(nFav, 'article')}). <Pourquoi label="Pourquoi ?">Une annonce recréée repart de zéro (favoris, vues, ancienneté). Pour un article qui a des favoris, baisser le prix de l'annonce actuelle les prévient — c'est souvent mieux que la recréer.</Pourquoi></div>}
              {nRec > 0 && <div data-republier-recentes={nRec} style={{ fontSize: 13, color: C.warn }}>{nRec > 1 ? `${nRec} articles déjà recréés` : '1 article déjà recréé'} il y a moins de 2 jours : risque de doublon, retire-{nRec > 1 ? 'les' : 'la'}.</div>}
            </>; })()}
            {majExt && <div data-republier-maj style={{ fontSize: 13, color: C.warn }}>Extension VRM à mettre à jour ({EXT_ATTENDUE}) et à connecter : sinon rien ne partira.</div>}
            {autresComptes > 0 && <div data-republier-autres-comptes style={{ fontSize: 13, color: C.warn }}>{autresComptes} sur un autre compte : ouvre Vinted sur ce compte {NAV.dansNu}, sinon {autresComptes > 1 ? 'elles ne partiront' : 'elle ne partira'} pas.</div>}
            {mode === 'idle' && <>
              <div data-republier-esp={espMode} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={maj}>Temps entre deux articles</span>
                <Segmente plein label="Temps entre deux articles" value={espMode} onChange={setEspMode} options={[{ v: 'vintex', l: 'Rapide (8–16 s)', data: { 'data-republier-esp-choix': 'vintex' } }, { v: 'aleatoire', l: `Lent (${minutesOk(espMin)}–${minutesOk(espMax)} min)`, data: { 'data-republier-esp-choix': 'aleatoire' } }, { v: 'fixe', l: 'Fixe', data: { 'data-republier-esp-choix': 'fixe' } }]} />
                {(() => { const n = aFaire.length; if (n < 2) return null; const moy = espMode === 'vintex' ? 12 : espMode === 'fixe' ? fileClamp(esp) : (bornesAlea()[0] + bornesAlea()[1]) / 2; const tousPlan = aFaire.every((a, i) => i === 0 || Number.isFinite(plan[a.id])); const sec = tousPlan ? Math.round(aFaire.reduce((t, a, i) => t + (i === 0 ? 0 : Number(plan[a.id]) || 0), 0)) : Math.round(moy * (n - 1)); const txt = sec < 60 ? `${sec} s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${Math.floor(sec / 3600)} h ${String(Math.round((sec % 3600) / 60)).padStart(2, '0')}`; return <div data-republier-esp-vintex={espMode === 'vintex' ? '' : undefined} data-republier-duree={sec} style={{ fontSize: 13, color: C.muted }}>Attente entre les {n} {motsVendeur().noms} : environ {txt} en tout.</div>; })()}
                {aFaire.length > GROUPE_MAX && <div data-republier-groupes={groupes ? 'on' : 'off'} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.text }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', flex: '1 1 220px' }}>
                    <input type="checkbox" data-republier-groupes-case checked={groupes} onChange={(ev) => setGroupes(ev.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0 }} />
                    <span>Par petits groupes ({GROUPE_MIN} à {GROUPE_MAX}), pause de {PAUSE_GROUPE_MIN_S / 60} à {PAUSE_GROUPE_MAX_S / 60} min entre deux</span>
                  </label>
                  {groupes && <Bouton variante="discret" data-republier-groupes-retirer onClick={refaitPlan}>Autres groupes</Bouton>}
                </div>}
                {espMode === 'fixe' && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>Une annonce toutes les <input data-republier-esp-fixe value={esp} onChange={(ev) => setEsp(fileClamp(ev.target.value))} inputMode="numeric" style={{ ...champ, width: 70 }} /> secondes</label>}
                {espMode === 'aleatoire' && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, flexWrap: 'wrap' }}>
                    <span>Entre</span><input data-republier-esp-min value={espMin} onChange={(ev) => setEspMin(ev.target.value)} onBlur={() => setEspMin(minutesOk(espMin))} inputMode="decimal" aria-label="Minimum en minutes" style={{ ...champ, width: 64 }} />
                    <span>et</span><input data-republier-esp-max value={espMax} onChange={(ev) => setEspMax(ev.target.value)} onBlur={() => setEspMax(minutesOk(espMax))} inputMode="decimal" aria-label="Maximum en minutes" style={{ ...champ, width: 64 }} /><span>minutes</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.muted }}>
                    <span style={{ flex: '1 1 200px' }}>Un temps par article (60 min au plus), écrit sur sa ligne.</span>
                    <Bouton variante="discret" data-republier-retirer onClick={refaitPlan}>Tirer d'autres temps</Bouton>
                  </div>
                </>}
              </div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.text, cursor: 'pointer' }}>
                <input type="checkbox" data-republier-confirme checked={ok} onChange={(ev) => setOk(ev.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent, flexShrink: 0, marginTop: 1 }} />
                <span>Je confirme : ces {aFaire.length} {action === 'enLigne' ? `brouillon${aFaire.length > 1 ? 's' : ''}` : `annonce${aFaire.length > 1 ? 's' : ''}`} {A.confirme(aFaire.length)}</span>
              </label>
            </>}
            {/* (29 oct., puis 30 oct.) Julien : « la barre de progression est incompréhensible ».
                Un seul bloc, EN HAUT, une seule barre : où j'en suis (« Paire 2 sur 5 »),
                l’article en cours et SON étape en une ligne (la liste des étapes repliée),
                combien sont faites / restent, ce qui a raté. Plus de seconde barre par
                ligne : la ligne ne dit que son état. */}
            <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {mode === 'idle' && aFaire.length > 1 && <div data-republier-ordre={ordre ? 'regle' : 'selection'} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                <span style={{ flex: '1 1 160px' }}>{ordre ? 'Ordre réglé à la main' : 'Ordre : celui de ta sélection'}</span>
                {ordre && <Bouton variante="discret" data-republier-ordre-selection onClick={() => setOrdre(null)}>Revenir à ma sélection</Bouton>}
                <Bouton className="vrm-b-petit" data-republier-melanger onClick={melanger} style={{ minHeight: 44 }}>Mélanger</Bouton>
              </div>}
              {aFaire.map((a, i) => { const s = st[a.id] || {};
                const pb = s.etat === 'echec' || s.etat === 'double' || s.etat === 'incertain' || s.etat === 'a-refaire';
                const statut = s.etat === 'fait' ? (s.refait ? 'brouillon refait' : A.fait) : s.etat === 'encours' ? 'en cours…' : s.etat === 'planifiee' ? `brouillon prêt · en ligne vers ${s.jusqua ? new Date(s.jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '…'}` : s.etat === 'echec' ? 'pas faite' : s.etat === 'a-refaire' ? 'brouillon à refaire' : s.etat ? '⚠ à vérifier' : (mode === 'idle' ? '' : 'en attente');
                // (30 oct.) La pause de Vinted est dite UNE fois, dans le bloc du haut :
                // la ligne dit seulement que la paire n'est pas partie à cause d'elle.
                const raison = s.code === 'frein-refus' ? 'pas partie : pause après un refus de Vinted (voir en haut)' : s.code === 'vinted-pause' || s.code === 'plafond' ? 'pas partie : arrêt demandé par Vinted (voir en haut)' : s.raison && (pb || s.refait) ? s.raison : '';
                const urlAncienne = action !== 'enLigne' && /^\d+$/.test(String(a.id || '')) ? `https://www.vinted.fr/items/${a.id}` : '';
                return (
                <div key={a.id} data-republier-ligne={a.id} data-republier-statut={s.etat || 'attente'} style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 32 }}>
                    <span style={{ flexShrink: 0, width: 18, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                    <span style={{ flex: 1, minWidth: 0, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.numero ? <b>N°{a.numero} · </b> : null}{a.titre}</span>
                    {!s.etat && a.id !== idAnnoncee && <span data-republier-attente={i === 0 ? 0 : (plan[a.id] || '')} style={{ flexShrink: 0, fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{i === 0 ? 'tout de suite' : pauses[a.id] ? <span data-republier-pause-groupe={pauses[a.id]}>Pause {Math.round(pauses[a.id] / 60)} min</span> : Number.isFinite(plan[a.id]) && plan[a.id] > 0 ? `+${duree(plan[a.id])}` : ''}</span>}
                    {mode === 'idle' && aFaire.length > 1 && <span style={{ display: 'flex', flexShrink: 0 }}>
                      <button type="button" aria-label="Monter" data-republier-monter={a.id} disabled={i === 0} onClick={() => bouger(a.id, -1)} style={{ border: 'none', background: 'transparent', color: i === 0 ? C.border : C.text, minWidth: 44, minHeight: 44, fontSize: 17, cursor: i === 0 ? 'default' : 'pointer' }}>↑</button>
                      <button type="button" aria-label="Descendre" data-republier-descendre={a.id} disabled={i === aFaire.length - 1} onClick={() => bouger(a.id, 1)} style={{ border: 'none', background: 'transparent', color: i === aFaire.length - 1 ? C.border : C.text, minWidth: 44, minHeight: 44, fontSize: 17, cursor: i === aFaire.length - 1 ? 'default' : 'pointer' }}>↓</button>
                    </span>}
                    {statut && <span data-republier-prevue={s.etat === 'planifiee' ? (s.jusqua || 0) : undefined} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: pb ? 'transparent' : s.etat === 'fait' ? 'var(--vrm-b-teinte)' : 'transparent', border: pb ? `1px solid ${C.warn}` : 'none', color: pb ? C.warn : s.etat === 'fait' ? C.text : C.muted, whiteSpace: 'nowrap' }}>{statut}</span>}
                  </div>
                  {raison && <div style={{ fontSize: 13, color: pb ? C.warn : C.muted, padding: '0 0 4px 26px', lineHeight: 1.45 }}>{raison}</div>}
                  {s.question && s.etat === 'echec' && mode !== 'run' && <div className="vrm-b-rangee" style={{ padding: '2px 0 4px 26px' }}><Bouton data-republier-question={s.question.champ} onClick={() => repondreLigne(a)}>{`Choisir ${s.question.nom || 'la valeur'}`}</Bouton></div>}
                  {s.etat === 'a-refaire' && refaire && mode !== 'run' && <div className="vrm-b-rangee" style={{ padding: '2px 0 4px 26px' }}><Bouton data-republier-refaire={a.id} onClick={() => refaireLigne(a)}>Refaire le brouillon</Bouton></div>}
                  {(s.etat === 'double' || s.etat === 'incertain') && urlAncienne && <div style={{ padding: '0 0 4px 26px' }}><Bouton variante="discret" href={urlAncienne} target="_blank" rel="noopener noreferrer" data-republier-voir-ancienne={a.id}>{s.etat === 'double' ? "Supprimer l'ancienne sur Vinted ↗" : 'Vérifier sur Vinted ↗'}</Bouton></div>}
                  {recree && pb && prog[String(a.id)] && prog[String(a.id)].etape && (() => { const lst = action === 'versBrouillon' ? ETAPES_REPUB.versBrouillon : ((viaBrouillon && !!brouillonOk) ? ETAPES_REPUB.brouillon : ETAPES_REPUB.direct); const pe = progressionRepub(prog[String(a.id)], action, viaBrouillon && !!brouillonOk); return (
                    <div data-republier-progression={a.id} data-republier-etape={pe.etape || 'attente'} style={{ padding: '0 0 4px 26px' }}>
                      <BarreGeste p={prog[String(a.id)]} liste={lst} label={`${motsVendeur().Nom} ${i + 1}`} issue="echec" barre={false} />
                    </div>
                  ); })()}
                </div>); })}
            </div>
            {/* (11 nov., lot republier-programme) « Lancer plus tard » : SON heure, ses réglages figés tels qu'à l'écran. */}
            {mode === 'idle' && !departProg && !!aFaire.length && ok && (
              <ProgrammerRepub uid={compteUid} compte={nomCompte} action={action} ids={aFaireCalc.map((a) => a.id)} reglages={reglagesFiges} verifier={verifierLot}
                existante={programme && programmeMode === 'modifier' && programme.etat === 'attente' ? programme : null}
                actuelle={progsRepub && compteUid ? progsRepub[compteUid] || null : null}
                onFait={() => { if (onProgrammeFait) onProgrammeFait(); }} />
            )}
          </>}
        </div>
        <div className="vrm-b-rangee" style={{ padding: '10px 16px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'nowrap' }}>
          {etape === 'choix' && <Bouton variante="primaire" data-republier-suivant disabled={!sel.size} title={!sel.size ? 'Choisis au moins un article' : undefined} onClick={() => setEtape(action === 'enLigne' ? 'envoi' : 'modif')}>Continuer ({sel.size})</Bouton>}
          {etape === 'modif' && <>
            <Bouton variante="discret" onClick={() => setEtape('choix')}>Retour</Bouton>
            <Bouton variante="primaire" data-republier-suivant disabled={!aFaire.length} title={!aFaire.length ? 'Rien à changer sur ces articles' : undefined} onClick={() => setEtape('envoi')}>Continuer ({aFaire.length})</Bouton>
          </>}
          {etape === 'envoi' && mode === 'idle' && <>
            <Bouton variante="discret" onClick={() => setEtape(action === 'enLigne' ? 'choix' : 'modif')}>Retour</Bouton>
            <Bouton variante="primaire" data-republier-lancer disabled={!ok || !aFaire.length} title={!aFaire.length ? 'Aucun article à envoyer' : !ok ? 'Coche « Je confirme » d’abord' : undefined} onClick={lancerFile}>{A.lancer} ({aFaire.length})</Bouton>
          </>}
          {mode === 'run' && <>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.muted }}>Garde cette fenêtre ouverte.</span>
            <Bouton data-republier-pause onClick={() => setMode('pause')} style={{ flex: '0 0 auto' }}>Pause</Bouton>
          </>}
          {mode === 'pause' && (() => { const resteMin = arretJusqua > Date.now() ? Math.ceil((arretJusqua - Date.now()) / 60000) : 0; return <>
            <Bouton data-republier-arreter onClick={() => setMode('fini')}>Arrêter</Bouton>
            <Bouton variante="primaire" data-republier-reprendre disabled={resteMin > 0} title={resteMin > 0 ? `Vinted demande d'attendre : possible dans ${resteMin} min` : undefined} onClick={() => setMode('run')}>{resteMin > 0 ? `Reprendre (dans ${resteMin} min)` : 'Reprendre'}</Bouton>
          </>; })()}
          {mode === 'fini' && (() => { const ids = aFaire.filter((a) => { const x = st[a.id] || {}; return x.etat === 'echec' || !x.etat; }).map((a) => a.id); return <>
            {onReessayer && ids.length > 0 && <Bouton data-republier-reessayer={ids.length} onClick={() => onReessayer(ids)}>{ids.length > 1 ? `Réessayer les ${ids.length} pas faites` : 'Réessayer la pas faite'}</Bouton>}
            <Bouton variante="primaire" data-republier-fermer onClick={onClose}>Fermer</Bouton>
          </>; })()}
        </div>
      </div>
    </VoileAtelier>
  );
}
export { RepublierVinted, AtelierFile, AtelierLots, AtelierBrouillon, RepublierALaMain, PreparerALaMain, BrouillonsVinted, BrouillonsARefaire };
