// ── « Avant de publier » POSÉ SUR UNE ANNONCE QUI EXISTE (28 nov.) : « Publier aussi sur… », la fiche de la paire ─────
// Le bloc commun (src/publier/AvantPublier.jsx) sur la fiche de CETTE annonce (`vinted_annonce_numeros[itemId]`, par
// identité). Les écritures sont des gestes annulables de l'app (`gesteVrm`) : le prix mini dans `min` + `minAt` (le champ
// que lisent le moteur des offres, la contre-offre, l'Agent VRM, les favoris, la baisse par règle et la garde du prix) ; le
// lien d'achat dans `buyFromId` / `buyFrom` (et le prix du REÇU seulement si aucun prix n'est saisi : `champsLien`).
// `app` : { load, gesteVrm, askConfirm, emettreClesRelues, bleamDe }.
import React from 'react';
import { tr } from '../i18n/index.js';
import { BlocAvantPublier, RelierAchatFeuille, useOutilsAchat, reglagesOffres } from './AvantPublier.jsx';
import { champsLien, ecritureMini } from './avantPublier.js';

const eurC = (c) => (Number.isSafeInteger(c) ? `${(c / 100).toFixed(c % 100 ? 2 : 0).replace('.', ',')} €` : '—');

export default function AvantPublierAnnonce({ itemId, prixC = null, app, cible = null, titre = '', attrs = null }) {
  const outils = useOutilsAchat();
  const [, maj] = React.useReducer((x) => x + 1, 0);
  const [relier, setRelier] = React.useState(false);
  React.useEffect(() => { const f = (e) => { const k = e && e.detail && e.detail.k; if (!k || k === 'vinted_annonce_numeros') maj(); }; window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f); }, []);
  if (!app || !itemId) return null;
  const fiches = app.load('vinted_annonce_numeros', {}) || {};
  const f = fiches[String(itemId)];
  if (!f) return null;
  const num = String(f.numero || '').trim();
  const apres = () => setTimeout(() => { try { app.emettreClesRelues(['vinted_annonce_numeros', 'vinted_buyprice_by_num']); } catch (_) {} maj(); }, 700);
  const onMini = (c) => {
    const w = ecritureMini(c);
    app.gesteVrm(c == null ? tr('ap.mini.efface') : tr('ap.mini.fait', { prix: eurC(c) }), [{ k: 'vinted_annonce_numeros', type: 'champs', id: String(itemId), apres: w, avant: { min: f.min, minAt: f.minAt } }], {}, apres);
    return true;
  };
  const onLien = (lien) => {
    const w = champsLien(f, lien); if (!w) return false;
    const ops = [{ k: 'vinted_annonce_numeros', type: 'champs', id: String(itemId), apres: w, avant: { buyPrice: f.buyPrice, buyFromId: f.buyFromId, buyFrom: f.buyFrom, buyPriceSource: f.buyPriceSource } }];
    if (w.buyPrice != null && num) ops.push({ k: 'vinted_buyprice_by_num', type: 'cleSiVide', id: num, apres: String(w.buyPrice) });
    app.gesteVrm(tr('ap.achat.relie'), ops, {}, apres, '', 'achat.relier');
    return true;
  };
  return (
    <>
      <BlocAvantPublier fiche={f} prixC={prixC} titre={titre} attrs={{ 'data-ap-annonce': String(itemId), ...(attrs || {}) }} reglages={reglagesOffres(app.load, app.bleamDe)}
        confirmer={({ titre: t, desc, ok }) => app.askConfirm({ title: t, desc, ok })} onMini={onMini} onRelier={outils ? () => setRelier(true) : null}/>
      {relier && outils ? <RelierAchatFeuille outils={outils} cible={cible || { titre: f.title || '', taille: f.size || '', dateRef: f.numberedAt || new Date().toISOString() }} onFermer={() => setRelier(false)} onRelier={onLien}/> : null}
    </>
  );
}
