// ── LA FACTURE D'ACHAT JOINTE : l'état et la pastille (10 nov., lot AN) ──────
// La règle et le stockage : src/factureAchat.js. Ici, ce que l'écran Achats tient :
// la liste des factures (sans contenu), « Joindre » (le sélecteur de fichier), et
// l'ouverture au toucher : une photo dans la visionneuse (src/Visionneuse.jsx), un
// PDF dans la visionneuse PDF de l'app (ou le lecteur du téléphone).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { verifierFichier, contenuValide, ecrireFacture, lireFactures, lireContenuFacture, retirerFacture } from './factureAchat.js';
import { ouvrirVisionneuse } from './visionneuse.js';

const lireDataUrl = (file) => new Promise((ok) => { try { const r = new FileReader(); r.onload = () => ok(String(r.result || '')); r.onerror = () => ok(''); r.readAsDataURL(file); } catch (_) { ok(''); } });
// Un data URL de PDF lu par FileReader peut porter un type vide : on le pose.
const enPdf = (d) => String(d || '').replace(/^data:[^;,]*;base64,/, 'data:application/pdf;base64,');

// deps : { fetch, url, auth, withOwner, conflit, owner, compresser(file) → dataURL|null, ouvrirPdf(url, nom) → bool, dire(msg, genre) }
export function useFacturesAchat(deps, actif = true) {
  const d = useRef(deps); d.current = deps;
  const [factures, setFactures] = useState(undefined);      // undefined en cours · null pas su · { cle → meta }
  const [enCours, setEnCours] = useState('');
  const entree = useRef(null);
  const cible = useRef('');
  const relire = useCallback(() => { lireFactures(d.current).then(setFactures); }, []);
  useEffect(() => { if (actif) relire(); }, [actif, relire]);
  // Joindre UN fichier à UN achat. Rend true seulement si la base l'a acceptée.
  const joindre = useCallback(async (cle, file) => {
    const D = d.current;
    if (!cle || !file) return false;
    const v = verifierFichier({ type: file.type, taille: file.size, nom: file.name });
    if (!v.ok) { D.dire(v.message, 'error'); return false; }
    setEnCours(cle);
    try {
      let dataUrl = '';
      if (v.genre === 'pdf') dataUrl = enPdf(await lireDataUrl(file));
      else dataUrl = (await D.compresser(file)) || '';
      if (!contenuValide(dataUrl, v.genre)) { D.dire(v.genre === 'pdf' ? 'Ce PDF est illisible.' : 'Photo illisible : essaie un JPEG ou un PDF.', 'error'); return false; }
      const ok = await ecrireFacture({ cle, dataUrl, genre: v.genre, nom: file.name, taille: file.size }, D);
      if (!ok) { D.dire('Facture pas envoyée : la base n’a pas répondu. Réessaie.', 'error'); return false; }
      setFactures((m) => ({ ...(m || {}), [cle]: { type: v.genre === 'pdf' ? 'pdf' : 'image', nom: file.name, taille: file.size, at: new Date().toISOString() } }));
      D.dire('Facture jointe');
      return true;
    } finally { setEnCours(''); }
  }, []);
  const choisir = useCallback((cle) => { cible.current = cle; try { entree.current && entree.current.click(); } catch (_) {} }, []);
  const ouvrir = useCallback(async (cle) => {
    const D = d.current; const f = factures && factures[cle];
    setEnCours(cle);
    const contenu = await lireContenuFacture(cle, D);
    setEnCours('');
    if (!contenu) { D.dire('Facture pas lue : réessaie dans un moment.', 'error'); return; }
    if (/^data:image\//.test(contenu)) { ouvrirVisionneuse([contenu], 0, { titre: 'Facture d’achat', sous: (f && f.nom) || '' }); return; }
    let url = contenu;
    try { const b = await (await fetch(contenu)).blob(); url = URL.createObjectURL(b); } catch (_) {}
    const nom = (f && f.nom) || 'facture.pdf';
    if (!D.ouvrirPdf(url, nom)) { try { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noreferrer'; a.download = nom; document.body.appendChild(a); a.click(); a.remove(); } catch (_) {} }
  }, [factures]);
  const retirer = useCallback(async (cle) => {
    const ok = await retirerFacture(cle, d.current);
    if (ok) setFactures((m) => { const n = { ...(m || {}) }; delete n[cle]; return n; });
    else d.current.dire('Pas retirée : la base n’a pas répondu.', 'error');
    return ok;
  }, []);
  const champ = (
    <input ref={entree} type="file" accept="application/pdf,image/*" data-facture-achat-fichier="" style={{ display: 'none' }}
      onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; const c = cible.current; cible.current = ''; if (f && c) joindre(c, f); }}/>
  );
  return { factures, enCours, joindre, choisir, ouvrir, retirer, relire, champ };
}

// « Facture jointe » sur un achat : une pastille qui s'ouvre au toucher.
export function PastilleFacture({ cle, f, onOuvrir, enCours = false, Icon = null }) {
  if (!f) return null;
  return (
    <button type="button" className="vrm-buy-chip vrm-buy-chip-facture" data-achat-facture-jointe={f.type} data-achat-facture-cle={cle}
      onClick={(e) => { e.stopPropagation(); onOuvrir(cle); }} title={f.nom || 'Facture jointe'} aria-busy={enCours || undefined}>
      {Icon ? <Icon name={f.type === 'pdf' ? 'doc' : 'image'} size={13}/> : null}<span>{enCours ? 'Ouverture…' : 'Facture jointe'}</span>
    </button>
  );
}
