// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE EN TÊTE DE MA JOURNÉE : « VINTED A MASQUÉ / A FAIT DISPARAÎTRE /
// LIMITE » (11 nov., extension 5.350)
// ═══════════════════════════════════════════════════════════════════════════
// La règle (ce qui est une alerte, le texte, quand elle s'arrête) :
// src/moderationVinted.js. Ici : UNE lecture projetée (`moderation_vinted_*`,
// `e` seulement), relue quand l'extension dit « moderation » ou au retour sur
// l'onglet. Chaque alerte dit QUOI (l'annonce par son N° — identité, jamais un
// titre), QUAND, la raison si Vinted la donne, et LE geste (un lien Vinted).
// « C'est vu » la range (`vrm_moderation_vu`, synchronisé) : elle reste dans
// Paramètres → « Ce que VRM a fait ».
// Pas su (lecture ratée) ⇒ rien : jamais d'alerte sur « pas su ». Une « disparue »
// dont la vente est PROUVÉE n'est pas une alerte (lue seulement s'il y en a une).
// Ambre (un geste à faire), jamais rouge (§7).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { lireTout, load, save, onCloudReady, lirePreuvesVenteVinted } from './App.jsx';
import { SELECT_MODERATION, LIGNE_MODERATION_VU, alertesActives, texteEvenement } from './moderationVinted.js';
import './styles-alerte-moderation.css';

export default function AlerteModeration({ comptes = [] }) {
  const [rows, setRows] = React.useState(undefined);
  const [vu, setVu] = React.useState(() => load(LIGNE_MODERATION_VU, {}) || {});
  const [vendues, setVendues] = React.useState(null);
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => {
    let mort = false;
    const lire = () => lireTout(`id=like.moderation_vinted_*&select=${SELECT_MODERATION}`, { strict: true })
      .then((r) => { if (!mort) { setRows(Array.isArray(r) ? r : null); setMaintenant(Date.now()); } }, () => { if (!mort) setRows(null); });
    lire();
    const surExt = (e) => { const d = e && e.detail; if (d && d.type === 'maj' && (d.quoi === 'moderation' || d.quoi === 'etatcompte')) lire(); };
    const auRetour = () => { if (document.visibilityState === 'visible') lire(); };
    const relireVu = () => setVu(load(LIGNE_MODERATION_VU, {}) || {});
    const off = onCloudReady(relireVu);
    const surSave = (e) => { if (e && e.detail && e.detail.k === LIGNE_MODERATION_VU) relireVu(); };
    window.addEventListener('vrm:ext', surExt);
    window.addEventListener('vrm:save', surSave);
    document.addEventListener('visibilitychange', auRetour);
    return () => { mort = true; off && off(); window.removeEventListener('vrm:ext', surExt); window.removeEventListener('vrm:save', surSave); document.removeEventListener('visibilitychange', auRetour); };
  }, []);
  // Les comptes qu'il a (jamais un compte retiré : « ne plus lui en parler »).
  const uids = React.useMemo(() => new Set((comptes || []).map((a) => String((a && a.vinted_user_id) || '')).filter(Boolean)), [comptes]);
  const brutes = React.useMemo(() => (Array.isArray(rows) ? alertesActives(rows, { vu, maintenant }) : null), [rows, vu, maintenant]);
  const aDisparue = !!(brutes && brutes.some((e) => e.s === 'disparue'));
  React.useEffect(() => {
    if (!aDisparue || vendues !== null) return undefined;
    let mort = false;
    lirePreuvesVenteVinted().then((p) => { if (!mort) setVendues(p && p.vendus instanceof Set ? p.vendus : false); }, () => { if (!mort) setVendues(false); });
    return () => { mort = true; };
  }, [aDisparue, vendues]);
  if (!Array.isArray(rows)) return null;                      // en cours ou pas su : rien
  const liste = alertesActives(rows, { vu, maintenant, vendues: vendues || null }).filter((e) => !uids.size || uids.has(e.compte));
  if (!liste.length) return null;
  const fiches = load('vinted_annonce_numeros', {}) || {};
  const labels = load('vinted_account_labels', {}) || {};
  const nomDe = (uid) => labels[uid] || ((comptes || []).find((a) => String(a && a.vinted_user_id) === String(uid)) || {}).login || '';
  const marquerVu = (cles) => {
    const v = { ...(load(LIGNE_MODERATION_VU, {}) || {}) };
    const t = Date.now();
    for (const k of cles) v[k] = t;
    // Borné : 300 clés, les plus récentes.
    const garde = Object.fromEntries(Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 300));
    save(LIGNE_MODERATION_VU, garde);
    setVu(garde);
  };
  return (
    <section className="vrm-moderation" data-moderation={liste.length} aria-label="Vinted a agi sur tes annonces ou ton compte">
      <div className="vrm-moderation-tete">
        <h2 className="vrm-moderation-titre">{liste.length > 1 ? `Vinted a agi ${liste.length} fois` : 'Vinted a agi'}</h2>
        {liste.length > 1 ? <button type="button" className="vrm-lien-action vrm-moderation-tout" data-moderation-tout-vu="" onClick={() => marquerVu(liste.map((e) => e.cle))}>Tout est vu</button> : null}
      </div>
      {liste.map((e) => {
        const t = texteEvenement(e, { numero: e.a && fiches[e.a] && fiches[e.a].numero ? fiches[e.a].numero : null, nom: nomDe(e.compte) });
        if (!t) return null;
        return (
          <div key={e.cle} className="vrm-moderation-ligne" data-moderation-sorte={e.s} data-moderation-compte={e.compte} data-moderation-item={e.a || undefined}>
            <div className="vrm-moderation-corps">
              <div className="vrm-moderation-quoi">{t.titre}</div>
              <div className="vrm-moderation-quand">{t.quand}</div>
              <div className="vrm-moderation-detail">{t.detail}</div>
            </div>
            <div className="vrm-moderation-gestes">
              <a className="vrm-moderation-geste" href={t.lien} target="_blank" rel="noopener noreferrer" data-moderation-geste={e.s}>{t.geste}</a>
              <button type="button" className="vrm-moderation-vu" data-moderation-vu={e.cle} onClick={() => marquerVu([e.cle])}>C’est vu</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
