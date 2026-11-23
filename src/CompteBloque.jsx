// ═══════════════════════════════════════════════════════════════════════════
// « VINTED A BLOQUÉ {COMPTE} » — L'ANNONCE ET LA QUESTION (19 nov., lot compte-bloque)
// ═══════════════════════════════════════════════════════════════════════════
// Sur la coque, au-dessus de tous les écrans, UNE carte par compte :
//   · bloqué (profil lu `is_account_banned`), aucun choix pour ce blocage ⇒
//     « Vinted a bloqué X · Mettre ses N annonces en pause ? » — Oui / Garder /
//     Plus tard (la question revient après 24 h) ;
//   · débloqué (profil relu « actif » APRÈS son « Oui ») ⇒ « X est débloqué :
//     N annonces remises » — OK la range.
// Son choix est écrit SEULEMENT sur son toucher (`vrm_comptes_bloques`, SYNC_KEYS) ;
// l'extension 5.409 le lit pour arrêter les gestes automatiques de ce compte.
// Rien de lu ⇒ rien. Ambre (un geste à faire), jamais rouge (§7).
// `N` : le compteur de la dernière lecture du dressing (`meta->>nItems`, scalaire).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { load, save, SUPABASE_URL, sbAuth } from './App.jsx';
import { tr, date as dateLangue } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { CLE_COMPTES_BLOQUES, cartesComptesBloques, choixPose, choixClos } from './compteBloque.js';
import { useComptesBloques, choixComptesBloquesChange } from './compteBloqueEtat.js';
import './styles-compte-bloque.css';

// Les compteurs d'annonces des comptes bloqués : une lecture scalaire, jamais `select=data`.
async function lireNombresAnnonces(uids) {
  const ok = uids.filter((u) => /^\d{1,20}$/.test(u));
  if (!ok.length) return {};
  try {
    const ids = ok.map((u) => `harvest_${u}_listings`).join(',');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=in.(${ids})&select=id,n:meta->>nItems`, { headers: sbAuth(), cache: 'no-store' });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const out = {};
    for (const x of rows) { const m = /^harvest_(\d+)_listings$/.exec(String((x && x.id) || '')); const n = Number(x && x.n); if (m && x.n != null && Number.isFinite(n)) out[m[1]] = n; }
    return out;
  } catch (_) { return null; }
}

export default function CompteBloque({ comptes = [] }) {
  useLangue();
  const { etats, choix } = useComptesBloques();
  const [annonces, setAnnonces] = React.useState({});
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => { const t = setInterval(() => setMaintenant(Date.now()), 10 * 60 * 1000); return () => clearInterval(t); }, []);
  const cartes = React.useMemo(() => cartesComptesBloques({ choix, etats, comptes, annonces, maintenant }), [choix, etats, comptes, annonces, maintenant]);
  const aLire = cartes.filter((c) => c.phase === 'question').map((c) => c.uid).sort().join(',');
  React.useEffect(() => {
    if (!aLire) return undefined;
    let mort = false;
    lireNombresAnnonces(aLire.split(',')).then((v) => { if (!mort && v) setAnnonces((a) => ({ ...a, ...v })); });
    return () => { mort = true; };
  }, [aLire]);
  if (!cartes.length) return null;
  const labels = load('vinted_account_labels', {}) || {};
  const nomDe = (uid) => labels[uid] || ((comptes || []).find((a) => String(a && a.vinted_user_id) === uid) || {}).login || `n° ${uid}`;
  const ecrire = (uid, entree) => {
    if (!entree) return;
    const cur = { ...(load(CLE_COMPTES_BLOQUES, {}) || {}) };
    cur[uid] = entree;
    save(CLE_COMPTES_BLOQUES, cur);
    choixComptesBloquesChange();
  };
  const choisir = (c, quoi) => ecrire(c.uid, choixPose(quoi, etats && etats[c.uid], c.n, Date.now()));
  const clore = (c) => ecrire(c.uid, choixClos((load(CLE_COMPTES_BLOQUES, {}) || {})[c.uid], Date.now()));
  return <div className="vrm-cb" data-compte-bloque-cartes={cartes.length}>
    {cartes.map((c) => {
      const nom = nomDe(c.uid);
      const e = etats && etats[c.uid];
      if (c.phase === 'remis') {
        return <section key={c.uid} className="vrm-cb-carte vrm-cb-remis" role="status" aria-live="polite" data-compte-bloque={c.uid} data-compte-bloque-phase="remis" data-compte-bloque-n={c.n == null ? '' : c.n}>
          <span className="vrm-cb-pastille vrm-cb-pastille-ok" aria-hidden="true">✓</span>
          <div className="vrm-cb-corps">
            <p className="vrm-cb-titre">{c.n != null ? tr('compteBloque.remis', { nom, n: c.n }) : tr('compteBloque.remisSansN', { nom })}</p>
            <p className="vrm-cb-texte">{tr('compteBloque.remisTexte')}</p>
            <div className="vrm-cb-gestes"><button type="button" className="vrm-cb-btn vrm-cb-plein" data-compte-bloque-geste="ok" onClick={() => clore(c)}>{tr('compteBloque.ok')}</button></div>
          </div>
        </section>;
      }
      const quand = e && e.at ? dateLangue(e.at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
      return <section key={c.uid} className="vrm-cb-carte" role="alertdialog" aria-labelledby={`vrm-cb-t-${c.uid}`} data-compte-bloque={c.uid} data-compte-bloque-phase="question" data-compte-bloque-n={c.n == null ? '' : c.n}>
        <span className="vrm-cb-pastille" aria-hidden="true">!</span>
        <div className="vrm-cb-corps">
          <p className="vrm-cb-sur">{tr('compteBloque.annonce')}</p>
          <p className="vrm-cb-titre" id={`vrm-cb-t-${c.uid}`}>{tr('compteBloque.titre', { nom })}</p>
          <p className="vrm-cb-question">{c.n != null ? tr('compteBloque.question', { n: c.n }) : tr('compteBloque.questionSansN')}</p>
          <p className="vrm-cb-texte">{tr('compteBloque.explique')}</p>
          {quand && <p className="vrm-cb-preuve">{tr('compteBloque.preuve', { date: quand })}</p>}
          <div className="vrm-cb-gestes">
            <button type="button" className="vrm-cb-btn vrm-cb-plein" data-compte-bloque-geste="pause" onClick={() => choisir(c, 'pause')}>{tr('compteBloque.oui')}</button>
            <button type="button" className="vrm-cb-btn" data-compte-bloque-geste="garder" onClick={() => choisir(c, 'garder')}>{tr('compteBloque.garder')}</button>
            <button type="button" className="vrm-cb-btn vrm-cb-lien" data-compte-bloque-geste="plus_tard" onClick={() => choisir(c, 'plus_tard')}>{tr('compteBloque.plusTard')}</button>
          </div>
        </div>
      </section>;
    })}
  </div>;
}
