// « Télécharger mes annonces » — Paramètres → Mes comptes (12 nov., sécurité des comptes).
// Un bouton par compte Vinted ⇒ un zip fait dans le navigateur (src/copieAnnonces.js).
// Lecture seule : rien n'est écrit, rien n'est envoyé à un serveur.
import React from 'react';
import { Bouton, C, fetchHarvest, load, telechargerFichier } from './App.jsx';
import { zipStocke } from './exportDonnees.js';
import { partagerOuTelecharger } from './exportComptableZip.js';
import { annoncesDuCompte, fichiersCopie, nomZipCopie } from './copieAnnonces.js';

const PARALLELE = 4;
async function lirePhoto(url) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit', ...(ctl ? { signal: ctl.signal } : {}) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch (_) { return null; } finally { if (t) clearTimeout(t); }
}

function LigneCompte({ compte }) {
  const uid = String(compte.vinted_user_id || '');
  const nom = compte.login || uid;
  const [etat, setEtat] = React.useState({ t: 'pret' });
  const enCours = etat.t === 'lecture' || etat.t === 'photos' || etat.t === 'zip';
  const lancer = async () => {
    if (enCours) return;
    setEtat({ t: 'lecture' });
    const dressing = await fetchHarvest(uid, 'listings');
    if (!dressing || !Array.isArray(dressing.items)) { setEtat({ t: 'passu' }); return; }
    let fiches = {}; try { fiches = load('vinted_annonce_numeros', {}) || {}; } catch (_) { fiches = {}; }
    const annonces = annoncesDuCompte(dressing, fiches);
    if (!annonces.length) { setEtat({ t: 'vide' }); return; }
    const urls = [...new Set(annonces.flatMap((a) => a.photos))];
    const photos = new Map(); let fait = 0;
    setEtat({ t: 'photos', fait, total: urls.length });
    const file = urls.slice();
    await Promise.all(Array.from({ length: Math.min(PARALLELE, file.length) }, async () => {
      while (file.length) { const u = file.shift(); const o = await lirePhoto(u); if (o) photos.set(u, o); fait++; setEtat({ t: 'photos', fait, total: urls.length }); }
    }));
    setEtat({ t: 'zip' });
    const quand = new Date();
    const { fichiers, resume } = fichiersCopie({ login: nom, annonces, photos, quand, lu: dressing._vrmLu || null });
    const octets = zipStocke(fichiers, quand);
    const r = await partagerOuTelecharger(octets, nomZipCopie(nom, quand), { telecharger: telechargerFichier });
    setEtat(r === 'annule' ? { t: 'pret' } : { t: 'fini', resume });
  };
  const dit = etat.t === 'lecture' ? 'Lecture des annonces…'
    : etat.t === 'photos' ? `Photos ${etat.fait}/${etat.total}…`
    : etat.t === 'zip' ? 'Préparation du zip…'
    : etat.t === 'passu' ? 'Annonces pas lues : ouvre ce dressing sur Vinted.'
    : etat.t === 'vide' ? 'Aucune annonce lue sur ce compte.'
    : etat.t === 'fini' ? `${etat.resume.annonces} annonces · ${etat.resume.photos} photos${etat.resume.photosManquees ? ` · ${etat.resume.photosManquees} pas lisibles` : ''}`
    : '';
  return (
    <div data-copie-compte={uid} data-copie-etat={etat.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
        {dit ? <div role="status" style={{ fontSize: 13, color: etat.t === 'passu' ? C.warn : C.muted }}>{dit}</div> : null}
      </div>
      <Bouton variante="secondaire" occupe={enCours} disabled={enCours} onClick={lancer} data-copie-telecharger={uid} style={{ minHeight: 44 }}>Télécharger</Bouton>
    </div>
  );
}

export default function CopieAnnonces({ comptes = [] }) {
  const liste = (Array.isArray(comptes) ? comptes : []).filter((c) => c && /^\d{1,20}$/.test(String(c.vinted_user_id || '')));
  return (
    <div data-copie-annonces={liste.length}>
      <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.45, color: C.muted }}>Un zip par compte : titres, descriptions, prix, N° et photos. Fait sur cet appareil, envoyé nulle part.</p>
      {liste.length ? liste.map((c) => <LigneCompte key={c.vinted_user_id} compte={c}/>) : <p style={{ fontSize: 13, color: C.muted }}>Aucun compte Vinted relié.</p>}
    </div>
  );
}
