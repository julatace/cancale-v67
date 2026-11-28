// ── L'HÔTE DU DOSSIER « À PUBLIER » (28 nov.) : les lectures et les écritures de l'app autour de src/aPublier/DossierAPublier.jsx ─
// Monté dans Annonces (src/ecrans/Comptabilite.jsx), à côté de la liste « À publier ». `app` porte les outils de l'app
// (load, save, gesteVrm, askConfirm, toast, cleNum, donnerNumerosBrouillons, poserPrixMiniLigne, confirmerNumerosAVerifier,
// imprimer, STUDIO_BASE, SUPABASE_URL, sbAuth, bleamDe, Icon, PreparerFiche, lireModelesRanges).
//   · les photos de chaque brouillon : la ligne `studio_photos_{cle}` (lire-fusionner-réécrire, comme le studio) ; la liste ne
//     lit que la vignette de la 1re photo, PAR PROJECTION (`data->photos->0->>vig`, jamais `select=data`) ;
//   · les brouillons : `vrm_fiches_neuves` (gestes annulables) ;
//   · la correspondance automatique est faite par la numérotation (bloc <numerotation-passage>) ; ici, seulement ce qui
//     reste AMBIGU (« Publiée ? Relie-la ») et SON choix.
import React from 'react';
import { tr } from '../i18n/index.js';
import DossierAPublier from './DossierAPublier.jsx';
import { brouillonsOuverts, correspondance, patchChoix } from './dossier.js';
import { empreintesDe } from '../republieTelephone.js';
import { useOutilsAchat, reglagesOffres } from '../publier/AvantPublier.jsx';

const RECENTE_MS = 14 * 86400e3;
const urlPhoto = (p) => (typeof p === 'string' ? p : (p && (p.url || p.full_size_url)) || '');

export default function HoteDossier({ app, annonces = null, empreintes = null, dateDe = null }) {
  const outils = useOutilsAchat();
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vrm_fiches_neuves' || k === 'vinted_annonce_numeros') maj(); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  const neuves = app.load('vrm_fiches_neuves', {}) || {};
  const numeros = app.load('vinted_annonce_numeros', {}) || {};
  const ouverts = brouillonsOuverts(neuves);
  // Les vignettes (projection, une lecture par ensemble de brouillons).
  const [vig, setVig] = React.useState({});
  const cles = ouverts.map((f) => (f.dossier || {}).cle).filter(Boolean).sort().join(',');
  React.useEffect(() => { let mort = false; if (!cles) return undefined;
    const ids = cles.split(',').map((c) => 'studio_photos_' + c);
    fetch(`${app.SUPABASE_URL}/rest/v1/app_data?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,v:data->photos->0->>vig`, { headers: app.sbAuth() })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (mort || !Array.isArray(j)) return; const o = {}; for (const x of j) if (x && x.v) o[String(x.id).replace(/^studio_photos_/, '')] = x.v; setVig(o); }).catch(() => {});
    return () => { mort = true; }; }, [cles]); // eslint-disable-line react-hooks/exhaustive-deps
  // Les annonces présentes récentes (le choix « Publiée ? Relie-la »), celles qu'aucun brouillon n'a déjà prises.
  const items = Array.isArray(annonces) ? annonces : [];
  const maintenant = Date.now();
  const nouvelles = items.filter((it) => { const f = numeros[String(it.id)] || {}; if (f.brouillonDe) return false; const t = dateDe ? dateDe(it) : null; return !(Number.isFinite(t) && t > 0) || maintenant - t < RECENTE_MS; })
    .map((it) => ({ id: String(it.id), titre: it.title || '', photo: urlPhoto(it.photo), numero: (numeros[String(it.id)] || {}).numero || '', creee: dateDe ? dateDe(it) : null }));
  const toutes = items.map((it) => ({ id: String(it.id), titre: it.title || '', numero: (numeros[String(it.id)] || {}).numero || '' }));
  const ambigus = React.useMemo(() => {
    if (!ouverts.length || !items.length) return {};
    try {
      return correspondance({ brouillons: ouverts, cle: app.cleNum, annonces: items.map((it) => ({ id: String(it.id), numero: (numeros[String(it.id)] || {}).numero, brouillonDe: (numeros[String(it.id)] || {}).brouillonDe,
        creee: dateDe ? dateDe(it) : null, hexes: empreintesDe(empreintes && it._acc ? (empreintes[`vinted:${it._acc.vinted_user_id}`] || {})[String(it.id)] : null) })) }).ambigus;
    } catch (_) { return {}; }
  }, [ouverts.map((f) => f.id + (f.numero || '')).join(','), items, empreintes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prep, setPrep] = React.useState(null);
  const geste = (texte, ops) => { app.gesteVrm(texte, ops, {}, () => setTimeout(() => { try { app.emettreClesRelues(['vrm_fiches_neuves', 'vinted_annonce_numeros']); } catch (_) {} maj(); }, 700)); return true; };
  const modifier = (id, patch, texte) => {
    const T = app.load('vrm_fiches_neuves', {}) || {}; const f = T[id]; if (!f) return false;
    const avant = {}; for (const k of Object.keys(patch)) avant[k] = f[k];
    return geste(texte, [{ k: 'vrm_fiches_neuves', type: 'champs', id: String(id), apres: patch, avant }]);
  };
  const ecrirePhotos = async (cle, photos) => {
    try { const m = await import('../studioPhoto.js'); const r = await m.modifierStudio(app.STUDIO_BASE, cle, '', () => photos); return !!(r && r.ok); } catch (_) { return false; }
  };
  const creer = async (faits) => geste(tr('dap.crees', { n: String(faits.length) }), faits.map((x) => ({ k: 'vrm_fiches_neuves', type: 'cle', id: x.id, apres: x.fiche, avant: undefined })));
  const imprimer = async (etq) => {
    const ok = await app.confirmerNumerosAVerifier(etq.map((e) => e.num));
    if (ok !== true) return false;
    return !!app.imprimer(etq);
  };
  const lier = async (b, annonceId) => {
    const N = app.load('vinted_annonce_numeros', {}) || {}; const f = N[annonceId] || {};
    const r = patchChoix(b, f, { cle: app.cleNum, numeroVendu: (k) => Object.values(app.load('vinted_sale_overrides', {}) || {}).some((o) => o && app.cleNum(o.numero) === k) });
    const avantA = {}; for (const k of Object.keys(r.patch)) avantA[k] = f[k];
    if (r.numero === 'garde') app.toast(tr('dap.choix.numeroGarde', { n: String(f.numero || '') }));
    return geste(tr('dap.choix.fait'), [
      { k: 'vinted_annonce_numeros', type: 'champs', id: annonceId, apres: r.patch, avant: avantA },
      { k: 'vrm_fiches_neuves', type: 'champs', id: String(b.id), apres: { publiee: { id: annonceId, at: new Date().toISOString(), de: 'choix' } }, avant: { publiee: b.publiee } },
    ]);
  };
  const Prep = app.PreparerFiche;
  return (
    <>
      <DossierAPublier neuves={neuves} nouvelles={nouvelles.length ? nouvelles : []} ambigus={ambigus} outils={outils} reglages={reglagesOffres(app.load, app.bleamDe)} vignettes={vig}
        ecrirePhotos={ecrirePhotos} creer={creer} modifier={modifier} donnerNumeros={app.donnerNumerosBrouillons} imprimer={imprimer} lier={lier}
        confirmer={({ titre, desc, ok }) => app.askConfirm({ title: titre, desc, ok })} dire={(t) => app.toast(t)} Icon={app.Icon}
        poserMiniNum={(n, c) => app.poserPrixMiniLigne({ num: n, min: c == null ? null : String(c / 100) })}
        ouvrirPreparer={Prep ? (b) => setPrep(b) : null} ouvrirAnnonce={(id) => { try { window.open(`https://www.vinted.fr/items/${encodeURIComponent(id)}`, '_blank', 'noopener'); } catch (_) {} }}
        annonceTitre={(id) => (toutes.find((x) => x.id === String(id)) || {}).titre || ''}/>
      {prep && Prep ? <Prep fiche={prep} modeles={app.lireModelesRanges ? app.lireModelesRanges() : []} onFermer={() => setPrep(null)}
        lireStudio={() => import('../studioPhoto.js').then((m) => m.lireStudio(app.STUDIO_BASE, app.cleNum(prep.numero)))}
        onEnregistrer={(fiche) => { const T = app.load('vrm_fiches_neuves', {}) || {}; if (!T[fiche.id]) return false; app.save('vrm_fiches_neuves', { ...T, [fiche.id]: { ...T[fiche.id], ...fiche } }); app.emettreClesRelues(['vrm_fiches_neuves']); maj(); app.toast(tr('depot.enregistre')); return true; }}/> : null}
    </>
  );
}
